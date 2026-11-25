/**
 * Anvil fork settings shared by the test fixture (`src/fixtures/anvilFork.ts`), `pnpm app:fork`
 * (`scripts/run-app-fork.js`) and `pnpm anvil:move-pin` (`scripts/anvil-move-pin.js`).
 *
 * Plain JS (with `fork.d.ts`) because the scripts run on Node without TypeScript.
 *
 * Why pin the fork block (`forkBlocks.json`): Anvil caches the state it fetches upstream in
 * `~/.foundry/cache/rpc/<chain>/<block>/` and reuses it only for the same block. Forking "latest"
 * means a new block, and a cold upstream fetch, every run: the app's first wallet-balance
 * multicall then takes ~30 s instead of ~15 ms. Pinning both forks (browser and app server) to the
 * same block also makes them start from the same chain state.
 */
import fs from 'node:fs';
import { URL } from 'node:url';

/** File holding the pinned block per chain (chain id → block number). */
export const FORK_BLOCKS_FILE = new URL('./forkBlocks.json', import.meta.url);

/** @type {Readonly<Record<string, number>>} */
export const PINNED_FORK_BLOCKS = Object.freeze(
  JSON.parse(fs.readFileSync(FORK_BLOCKS_FILE, 'utf8')),
);

/**
 * Public archive RPCs to fork each chain from, tried in order (`ANVIL_FORK_URL` replaces them).
 * @type {Readonly<Record<number, readonly string[]>>}
 */
export const FORK_UPSTREAM_RPCS = Object.freeze({
  1: [
    'https://gateway.tenderly.co/public/mainnet',
    'https://ethereum-rpc.publicnode.com',
    'https://rpc.mevblocker.io',
    'https://eth.drpc.org',
  ],
  8453: ['https://mainnet.base.org', 'https://base.llamarpc.com', 'https://1rpc.io/base'],
  42161: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum.llamarpc.com', 'https://1rpc.io/arb'],
});

/**
 * Whether the upstream RPC `url` serves state at `block`. Anvil reads every account or storage
 * slot of the fork block it hasn't cached from upstream, so an RPC that refuses old state (pruned,
 * or archive behind a token, like publicnode) breaks those reads even though Anvil starts and
 * answers cached ones. Never throws: an error or timeout counts as "no".
 *
 * @param {string} url
 * @param {number} block
 * @param {number} [timeoutMs]
 * @returns {Promise<boolean>}
 */
export async function servesStateAt(url, block, timeoutMs = 10_000) {
  try {
    const response = await globalThis.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBalance',
        params: ['0x0000000000000000000000000000000000000000', `0x${block.toString(16)}`],
      }),
      signal: globalThis.AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return false;
    const body = await response.json();
    return typeof body.result === 'string';
  } catch {
    return false;
  }
}

/**
 * Parses a block number as typed by a user (`ANVIL_FORK_BLOCK`, `--block=`).
 * @param {string} value
 * @returns {number}
 */
export function parseBlockNumber(value) {
  const block = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(block) || block <= 0) {
    throw new Error(`Invalid block number "${value}"`);
  }
  return block;
}

/**
 * Checks a candidate pin (`pnpm anvil:move-pin`) against the chain's finalized block and the current pin.
 *
 * @param {{ block: number, finalized: number, current?: number | null }} args
 * @returns {{ error?: string, warnings: string[] }}
 */
export function checkNewPin({ block, finalized, current = null }) {
  if (block > finalized) {
    return {
      error: `Block ${block} is not finalized yet (latest finalized: ${finalized}). A reorg could replace it; pick ${finalized} or older.`,
      warnings: [],
    };
  }
  if (block === current) {
    return { error: `Block ${block} is already the pin.`, warnings: [] };
  }
  const warnings = [];
  if (current && block < current) {
    warnings.push(
      `Block ${block} is older than the current pin (${current}): vaults and tokens deployed in between won't exist on the fork.`,
    );
  }
  return { warnings };
}

/**
 * The block to fork `chainId` at, or `null` for the latest block.
 *
 * `override` (`ANVIL_FORK_BLOCK`, or `app:fork --block=`) wins when set: a block number, or
 * `latest` to fork the live chain head. Otherwise the chain's pinned block, or `null` for a chain
 * with no pin.
 *
 * @param {number} chainId
 * @param {string | undefined | null} [override]
 * @param {Readonly<Record<string, number>>} [pins]
 * @returns {number | null}
 */
export function resolveForkBlock(chainId, override, pins = PINNED_FORK_BLOCKS) {
  const value = override?.trim();
  if (value) {
    if (value.toLowerCase() === 'latest') return null;
    try {
      return parseBlockNumber(value);
    } catch (err) {
      throw new Error(`${err.message}: use a block number or "latest"`);
    }
  }
  return pins[String(chainId)] ?? null;
}
