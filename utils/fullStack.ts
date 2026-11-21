/**
 * Helpers for the full-stack suite (tests/e2e/fullstack): the chain, the indexer and the app are
 * separate processes, so a test must wait for each layer to converge instead of sleeping.
 *
 *   1. On-chain: the transaction is mined and succeeded (receipt status 0x1)
 *   2. Indexer: Ponder has indexed at least that block
 *   3. UI: Playwright's auto-waiting assertions on the page
 */
import { expect } from '@playwright/test';
import {
  decodeFunctionResult,
  encodeFunctionData,
  erc20Abi,
  parseAbi,
  type Abi,
  type Address,
  type Hex,
} from 'viem';
import pg from 'pg';
import { jsonRpc } from '../src/fixtures/anvilFork';

export const FULLSTACK_RPC_URL = process.env.FULLSTACK_RPC_URL || 'http://127.0.0.1:18545';
export const FULLSTACK_PONDER_URL = process.env.FULLSTACK_PONDER_URL || 'http://127.0.0.1:42169';
/** The app's own database in the stack's Postgres (scripts/fullstack/run.js creates it). */
export const FULLSTACK_APP_DB_URL =
  process.env.FULLSTACK_APP_DB_URL || 'postgres://ponder:ponder@127.0.0.1:15432/sovereign_app';

export type Receipt = { status: Hex; blockNumber: Hex; to: Address | null; logs: unknown[] };

export const rpc = <T>(method: string, params: unknown[] = []) =>
  jsonRpc<T>(FULLSTACK_RPC_URL, method, params);

/** Waits until `hash` is mined and asserts it succeeded. */
export async function waitForSuccessfulReceipt(hash: Hex, timeout = 60_000): Promise<Receipt> {
  let receipt: Receipt | null = null;
  await expect
    .poll(async () => (receipt = await rpc<Receipt | null>('eth_getTransactionReceipt', [hash])), {
      message: `transaction ${hash} should be mined`,
      timeout,
    })
    .not.toBeNull();
  expect(receipt!.status, `transaction ${hash} should succeed`).toBe('0x1');
  return receipt!;
}

/** Sends a transaction from an impersonated/unlocked account and waits for it to succeed. */
export async function sendAndConfirm(tx: Record<string, string>): Promise<Receipt> {
  const hash = await rpc<Hex>('eth_sendTransaction', [tx]);
  return waitForSuccessfulReceipt(hash);
}

/** Block Ponder has indexed up to (0 while it is unreachable). */
export async function indexedBlock(): Promise<number> {
  try {
    const res = await fetch(`${FULLSTACK_PONDER_URL}/status`, {
      signal: AbortSignal.timeout(5_000),
    });
    const status = (await res.json()) as Record<string, { block?: { number?: number } }>;
    return Number(Object.values(status)[0]?.block?.number ?? 0);
  } catch {
    return 0;
  }
}

/** Waits until the indexer has caught up with `blockNumber`. */
export async function waitForIndexer(blockNumber: number, timeout = 120_000) {
  await expect
    .poll(indexedBlock, { message: `indexer should reach block ${blockNumber}`, timeout })
    .toBeGreaterThanOrEqual(blockNumber);
}

/** Runs a query against Ponder's GraphQL API. */
export async function ponderQuery<T>(query: string, variables: Record<string, unknown> = {}) {
  const res = await fetch(`${FULLSTACK_PONDER_URL}/graphql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (!res.ok || body.errors?.length || !body.data) {
    throw new Error(
      `Ponder query failed (HTTP ${res.status}): ${body.errors?.map((e) => e.message).join('; ')}`,
    );
  }
  return body.data;
}

export type PositionSnapshot = {
  lifecycle: number;
  action: string | null;
  netValueUsd: number | null;
  collateralUsd: number | null;
  debtUsd: number | null;
  blockNumber: string;
};

/** The newest position snapshot Ponder holds for `safe`, or null if it has none. */
export async function latestPositionSnapshot(safe: Address): Promise<PositionSnapshot | null> {
  const { safes } = await ponderQuery<{ safes: { items: { id: string }[] } }>(
    'query ($address: String!) { safes(where: { address: $address }) { items { id } } }',
    { address: safe.toLowerCase() },
  );
  const safeId = safes.items[0]?.id;
  if (!safeId) return null;
  const { positionSnapshots } = await ponderQuery<{
    positionSnapshots: { items: PositionSnapshot[] };
  }>(
    `query ($safeId: String!) {
      positionSnapshots(where: { safeId: $safeId }, orderBy: "blockNumber", orderDirection: "desc", limit: 1) {
        items { lifecycle action netValueUsd collateralUsd debtUsd blockNumber }
      }
    }`,
    { safeId },
  );
  return positionSnapshots.items[0] ?? null;
}

/** Calls a view function on the fork. `abi` must contain `functionName`. */
export async function readContract<T>(
  address: Address,
  abi: Abi,
  functionName: string,
  args: unknown[] = [],
): Promise<T> {
  // viem's generics cannot follow a runtime function name; callers declare the return type
  const call = { abi, functionName, args } as Parameters<typeof encodeFunctionData>[0];
  const data = await rpc<Hex>('eth_call', [
    { to: address, data: encodeFunctionData(call) },
    'latest',
  ]);
  return decodeFunctionResult({ ...call, data } as Parameters<typeof decodeFunctionResult>[0]) as T;
}

/** A raw token amount in whole units. */
export const toUnits = (amount: bigint, decimals: number) => Number(amount) / 10 ** decimals;

/** `token` balance of `owner` in whole units. */
export async function tokenUnits(token: Address, owner: Address, decimals: number) {
  return toUnits(await erc20Balance(token, owner), decimals);
}

export async function erc20Balance(token: Address, owner: Address): Promise<bigint> {
  const data = encodeFunctionData({ abi: erc20Abi, functionName: 'balanceOf', args: [owner] });
  const result = await rpc<Hex>('eth_call', [{ to: token, data }, 'latest']);
  return decodeFunctionResult({ abi: erc20Abi, functionName: 'balanceOf', data: result });
}

/** Runs one read-only query against the app's database. */
export async function queryAppDb<T extends pg.QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const client = new pg.Client({ connectionString: FULLSTACK_APP_DB_URL });
  await client.connect();
  try {
    return (await client.query<T>(sql, params)).rows;
  } finally {
    await client.end();
  }
}

export type TermsAcceptanceRecord = {
  acceptances: { signature: string; nonce: string; terms_version: string; terms_hash: string }[];
  screenings: { sanctioned: boolean; action: string | null }[];
  attributions: { terms_nonce: string | null }[];
};

/** What the app stored when `wallet` accepted the Terms of Service (addresses are stored lowercased). */
export async function termsAcceptanceRecord(wallet: Address): Promise<TermsAcceptanceRecord> {
  const address = wallet.toLowerCase();
  const [acceptances, screenings, attributions] = await Promise.all([
    queryAppDb<TermsAcceptanceRecord['acceptances'][number]>(
      'SELECT signature, nonce, terms_version, terms_hash FROM terms_acceptances WHERE wallet_address = $1',
      [address],
    ),
    queryAppDb<TermsAcceptanceRecord['screenings'][number]>(
      'SELECT sanctioned, action FROM wallet_screenings WHERE wallet_address = $1',
      [address],
    ),
    queryAppDb<TermsAcceptanceRecord['attributions'][number]>(
      'SELECT terms_nonce FROM wallet_attribution WHERE wallet_address = $1',
      [address],
    ),
  ]);
  return { acceptances, screenings, attributions };
}

const safeAbi = parseAbi(['function getOwners() view returns (address[])']);

/** Owners of a Safe smart account. */
export async function safeOwners(safe: Address): Promise<Address[]> {
  const data = encodeFunctionData({ abi: safeAbi, functionName: 'getOwners' });
  const result = await rpc<Hex>('eth_call', [{ to: safe, data }, 'latest']);
  return [...decodeFunctionResult({ abi: safeAbi, functionName: 'getOwners', data: result })];
}
