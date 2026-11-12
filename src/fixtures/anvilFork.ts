import { test as base, type Route } from '@playwright/test';
import {
  decodeFunctionResult,
  encodeFunctionData,
  erc20Abi,
  parseEther,
  parseUnits,
  toHex,
  type Address,
  type Hex,
  type LocalAccount,
} from 'viem';
import { mnemonicToAccount, privateKeyToAccount } from 'viem/accounts';
import { App } from '../app';
import { TIMEOUTS } from '../../utils/constants/timeouts';
import { wethMainnetAddress } from '../../utils/constants/addresses';
import { createEIP1193Script } from './mockProvider';
import { connectEip1193Wallet } from '../../utils/connectEip1193Wallet';
import { spawn, type ChildProcess } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import process from 'node:process';
import { URL } from 'node:url';

// -----------------------------------------------------------------------------
// Canonical Anvil Account #0 & Viem Signer Setup
// -----------------------------------------------------------------------------
// Anvil dev account #0 (public, test-only key). Fork tests never use the staging wallet's key.
const ANVIL_DEV_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const;

// The app signs terms with its own TERMS_VERSION and never compares this value; display only
const MOCK_TERMS_VERSION = 'anvil-fork-mock';

export const defaultAnvilAccount = privateKeyToAccount(ANVIL_DEV_PRIVATE_KEY);
export const defaultAnvilAddress = defaultAnvilAccount.address;

// Anvil's well-known dev mnemonic (public, test-only). Accounts 0-9 are the ones Anvil pre-funds.
const ANVIL_DEV_MNEMONIC = 'test test test test test test test test test test test junk';

/** Accounts the mock wallet can sign for, keyed by lowercase address. */
const signerAccounts = new Map<string, LocalAccount>(
  [
    defaultAnvilAccount,
    ...Array.from({ length: 10 }, (_, addressIndex) =>
      mnemonicToAccount(ANVIL_DEV_MNEMONIC, { addressIndex }),
    ),
  ].map((account) => [account.address.toLowerCase(), account]),
);

const isAddress = (value: unknown): value is string =>
  typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value);

function signerFor(address: unknown): LocalAccount {
  const account = isAddress(address) ? signerAccounts.get(address.toLowerCase()) : undefined;
  if (!account) {
    throw new Error(
      `[Playwright Signer] No private key for ${String(address)}. ` +
        'The mock wallet can only sign for Anvil dev accounts 0-9.',
    );
  }
  return account;
}

// -----------------------------------------------------------------------------
// Curated Archive RPC Endpoints
// (Public RPCs verified to support archive storage reads without token requirements)
// -----------------------------------------------------------------------------
const ARCHIVE_RPCS: Record<number, string[]> = {
  1: [
    'https://gateway.tenderly.co/public/mainnet',
    'https://ethereum-rpc.publicnode.com',
    'https://rpc.mevblocker.io',
    'https://eth.drpc.org',
  ],
  8453: ['https://mainnet.base.org', 'https://base.llamarpc.com', 'https://1rpc.io/base'],
  42161: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum.llamarpc.com', 'https://1rpc.io/arb'],
};

// -----------------------------------------------------------------------------
// Binary Detection for Anvil
// -----------------------------------------------------------------------------
export function findAnvilBinary(): string {
  const candidates = [
    process.env.ANVIL_PATH,
    path.join(os.homedir(), '.foundry', 'bin', 'anvil'),
    '/usr/local/bin/anvil',
    '/opt/homebrew/bin/anvil',
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  const pathDirs = (process.env.PATH || '').split(path.delimiter);
  for (const dir of pathDirs) {
    const full = path.join(dir, 'anvil');
    if (fs.existsSync(full)) {
      return full;
    }
  }

  throw new Error(
    'Anvil binary not found. Please install Foundry (curl -L https://foundry.paradigm.xyz | bash && foundryup) or set ANVIL_PATH.',
  );
}

// -----------------------------------------------------------------------------
// Port Allocation
// Defaults away from 8545, which `pnpm app:fork` uses for its own shared Anvil node.
// -----------------------------------------------------------------------------
const DEFAULT_ANVIL_BASE_PORT = 8600;

function assertPortFree(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', (err: NodeJS.ErrnoException) => {
      reject(
        err.code === 'EADDRINUSE'
          ? new Error(
              `Port ${port} is already in use (is \`pnpm app:fork\` or another Anvil running on it?). ` +
                `Set ANVIL_BASE_PORT to a free range (default: ${DEFAULT_ANVIL_BASE_PORT}).`,
            )
          : err,
      );
    });
    server.once('listening', () => server.close(() => resolve()));
    server.listen(port, '127.0.0.1');
  });
}

function stopProcess(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    // Escalate if Anvil ignores SIGTERM, so teardown can never hang
    const forceKill = setTimeout(() => child.kill('SIGKILL'), 5_000);
    child.once('exit', () => {
      clearTimeout(forceKill);
      resolve();
    });
    child.kill('SIGTERM');
  });
}

// -----------------------------------------------------------------------------
// Lightweight JSON-RPC Client
// -----------------------------------------------------------------------------
export async function jsonRpc<T = unknown>(
  rpcUrl: string,
  method: string,
  params: unknown[] = [],
  timeoutMs = 20000,
): Promise<T> {
  const url = new URL(rpcUrl);
  const payload = JSON.stringify({
    jsonrpc: '2.0',
    id: Date.now() + Math.floor(Math.random() * 1000),
    method,
    params,
  });

  return new Promise<T>((resolve, reject) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: timeoutMs,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              reject(new Error(`RPC error (${parsed.error.code}): ${parsed.error.message}`));
            } else {
              resolve(parsed.result as T);
            }
          } catch {
            reject(new Error(`Malformed JSON response from RPC: ${data.slice(0, 150)}`));
          }
        });
      },
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`RPC request timed out after ${timeoutMs}ms: ${method}`));
    });

    req.write(payload);
    req.end();
  });
}

// -----------------------------------------------------------------------------
// Helper: Forward Raw JSON-RPC POST to Anvil (response passed through unchanged)
// -----------------------------------------------------------------------------
function forwardToAnvil(rpcUrl: string, postData: string): Promise<string> {
  const url = new URL(rpcUrl);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
        timeout: 10000,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => resolve(data));
      },
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Forward to Anvil timed out: ${rpcUrl}`));
    });

    req.write(postData);
    req.end();
  });
}

// -----------------------------------------------------------------------------
// Browser RPC Routing (forked chain only)
// -----------------------------------------------------------------------------
// Public RPC endpoints the browser may hit directly, keyed by chain. Host + path prefix,
// because multi-chain providers (1rpc.io, llamarpc) select the chain via the path or subdomain.
const PUBLIC_BROWSER_RPCS: Record<number, string[]> = {
  1: [
    'ethereum-rpc.publicnode.com',
    'cloudflare-eth.com',
    'eth.llamarpc.com',
    'rpc.ankr.com/eth',
    '1rpc.io/eth',
  ],
  8453: ['mainnet.base.org', 'base-rpc.publicnode.com', 'base.llamarpc.com', '1rpc.io/base'],
  42161: [
    'arb1.arbitrum.io/rpc',
    'arbitrum-one-rpc.publicnode.com',
    'arbitrum.llamarpc.com',
    '1rpc.io/arb',
  ],
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Matches the app's same-origin proxy for exactly this chain, e.g. `/api/rpc/1` but not `/api/rpc/10`. */
function appRpcProxyPattern(chainId: number): RegExp {
  return new RegExp(`/api/rpc/${chainId}(?:[/?#]|$)`);
}

function publicRpcPatternFor(chainId: number): RegExp | undefined {
  const endpoints = PUBLIC_BROWSER_RPCS[chainId];
  if (!endpoints?.length) return undefined;
  return new RegExp(`^https?://(?:${endpoints.map(escapeRegExp).join('|')})(?:[/?#]|$)`);
}

/**
 * The app's wagmi transports are `fallback([/api/rpc/<id>, rpc.walletconnect.org?chainId=eip155:<id>])`.
 * The fallback must hit Anvil too, or any proxy error silently switches the app to live chain data.
 */
function walletConnectRpcPattern(chainId: number): RegExp {
  return new RegExp(
    `^https://rpc\\.walletconnect\\.org/v1/?\\?(?:.*&)?chainId=eip155:${chainId}(?:&|$)`,
  );
}

/**
 * Forwards JSON-RPC POSTs to Anvil. If forwarding fails, responds 502 instead of letting the
 * request through to the real network, which would silently mix live chain data into the test.
 */
function createAnvilRpcHandler(rpcUrl: string) {
  return async (route: Route) => {
    const request = route.request();
    const postData = request.postData();

    if (request.method() !== 'POST' || !postData) {
      await route.fulfill({
        status: 405,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Anvil fork routing only supports JSON-RPC POST requests' }),
      });
      return;
    }

    try {
      const responseData = await forwardToAnvil(rpcUrl, postData);
      await route.fulfill({ status: 200, contentType: 'application/json', body: responseData });
    } catch (err) {
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({
          error: `Anvil fork at ${rpcUrl} unreachable: ${(err as Error).message}`,
        }),
      });
    }
  };
}

// -----------------------------------------------------------------------------
// ERC-20 / Transaction Helpers for Fork Funding
// -----------------------------------------------------------------------------
const wethDepositAbi = [
  { type: 'function', name: 'deposit', stateMutability: 'payable', inputs: [], outputs: [] },
] as const;

async function erc20BalanceOf(rpcUrl: string, token: Address, owner: Address): Promise<bigint> {
  const data = encodeFunctionData({ abi: erc20Abi, functionName: 'balanceOf', args: [owner] });
  const result = await jsonRpc<Hex>(rpcUrl, 'eth_call', [{ to: token, data }, 'latest']);
  return decodeFunctionResult({ abi: erc20Abi, functionName: 'balanceOf', data: result });
}

async function erc20Decimals(rpcUrl: string, token: Address): Promise<number> {
  const data = encodeFunctionData({ abi: erc20Abi, functionName: 'decimals' });
  const result = await jsonRpc<Hex>(rpcUrl, 'eth_call', [{ to: token, data }, 'latest']);
  return decodeFunctionResult({ abi: erc20Abi, functionName: 'decimals', data: result });
}

/** Sends a transaction (no fixed gas, so reverts fail at estimation) and checks it succeeded. */
async function sendAndConfirm(rpcUrl: string, tx: Record<string, string>): Promise<void> {
  const hash = await jsonRpc<Hex>(rpcUrl, 'eth_sendTransaction', [tx]);

  // Automine on a fork is not synchronous with eth_sendTransaction: poll briefly for the receipt
  let receipt: { status: Hex } | null = null;
  for (let attempt = 0; attempt < 50 && !receipt; attempt++) {
    receipt = await jsonRpc<{ status: Hex } | null>(rpcUrl, 'eth_getTransactionReceipt', [hash]);
    if (!receipt) await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (receipt?.status !== '0x1') {
    throw new Error(`Transaction ${hash} failed (status: ${receipt?.status ?? 'no receipt'}).`);
  }
}

// -----------------------------------------------------------------------------
// Controller Interfaces
// -----------------------------------------------------------------------------
export interface AnvilForkController {
  port: number;
  rpcUrl: string;
  chainId: number;
  /** Current baseline snapshot; re-taken after `revert()` to the baseline */
  readonly snapshotId: string;
  rpc<T = unknown>(method: string, params?: unknown[]): Promise<T>;
  snapshot(): Promise<string>;
  revert(snapshotId?: string): Promise<boolean>;
  setBalance(address: string, etherAmount: number | bigint | string): Promise<void>;
  impersonateAccount(address: string): Promise<void>;
  stopImpersonatingAccount(address: string): Promise<void>;
  /**
   * Gives `recipient` `amount` whole tokens (e.g. `0.5` = half a token).
   * WETH is minted by wrapping the recipient's ETH; any other token is transferred from `whale`,
   * which must hold enough of it. Throws if the transfer reverts or the balance does not increase.
   */
  fundToken(options: {
    tokenAddress: string;
    recipient: string;
    amount: bigint | number | string;
    /** Required for every token except WETH */
    whale?: string;
    /** Read from the token contract when omitted */
    decimals?: number;
  }): Promise<void>;
  increaseTime(seconds: number): Promise<number>;
  /**
   * Answers the forked chain's `/api/rpc/<chainId>` calls with HTTP 429, exactly as the
   * app's own proxy does when rate-limited. Active until `stop()` is called.
   * `hits()` counts rate-limited requests so tests can prove the fault was hit.
   */
  simulateRpcRateLimit(): Promise<{ hits: () => number; stop: () => Promise<void> }>;
  mine(blocks?: number): Promise<void>;
}

export interface EIP1193Controller {
  walletAddress: string;
  mockRejectNext(val?: boolean): Promise<void>;
  switchAccount(newAddress: string): Promise<void>;
  switchChain(newChainId: number | string): Promise<void>;
  setConnected(val: boolean): Promise<void>;
}

export interface AnvilServer {
  port: number;
  rpcUrl: string;
  chainId: number;
  process: ChildProcess;
}

type TestOptions = {
  autoConnectWallet?: boolean;
  termsSigned?: boolean;
};

type TestFixtures = {
  app: App;
  anvilFork: AnvilForkController;
  eip1193: EIP1193Controller;
};

type WorkerFixtures = {
  anvilServer: AnvilServer;
};

// -----------------------------------------------------------------------------
// Playwright Test Fixture with EIP-1193 Mock Provider & Worker-Isolated Anvil Lifecycle
// -----------------------------------------------------------------------------
export const test = base.extend<TestFixtures & TestOptions, WorkerFixtures>({
  autoConnectWallet: [true, { option: true }],
  termsSigned: [true, { option: true }],

  // ---------------------------------------------------------------------------
  // Worker-Scoped: Programmatic Anvil Fork with Worker Isolation
  // Port = (ANVIL_BASE_PORT || DEFAULT_ANVIL_BASE_PORT) + parallelIndex
  // ---------------------------------------------------------------------------
  anvilServer: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use, workerInfo) => {
      const basePort = parseInt(process.env.ANVIL_BASE_PORT || String(DEFAULT_ANVIL_BASE_PORT), 10);
      const port = basePort + workerInfo.parallelIndex;
      const rpcUrl = `http://127.0.0.1:${port}`;
      const chainId = parseInt(process.env.ANVIL_FORK_CHAIN || '1', 10);

      const candidateRpcs = process.env.ANVIL_FORK_URL
        ? [process.env.ANVIL_FORK_URL]
        : ARCHIVE_RPCS[chainId] || ['https://ethereum-rpc.publicnode.com'];

      const anvilBin = findAnvilBinary();

      let activeProcess: ChildProcess | null = null;
      let lastErrorOutput = '';

      const killActive = () => {
        if (activeProcess && activeProcess.exitCode === null) {
          try {
            activeProcess.kill('SIGTERM');
          } catch {
            // ignore
          }
        }
      };

      process.on('exit', killActive);

      for (const upstreamRpc of candidateRpcs) {
        // Fail fast instead of letting the health check succeed against someone else's node
        await assertPortFree(port);

        const anvilArgs = [
          '--fork-url',
          upstreamRpc,
          '--chain-id',
          chainId.toString(),
          '--port',
          port.toString(),
          '--auto-impersonate',
          '--code-size-limit',
          '40000',
          '--gas-limit',
          '30000000',
          '--compute-units-per-second',
          '100',
          '--retries',
          '5',
          '--timeout',
          '30000',
          '--fork-retry-backoff',
          '1000',
        ];

        if (process.env.ANVIL_FORK_BLOCK) {
          anvilArgs.push('--fork-block-number', process.env.ANVIL_FORK_BLOCK);
        }

        let currentStderr = '';
        const anvilProcess = spawn(anvilBin, anvilArgs, {
          detached: false,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        activeProcess = anvilProcess;

        anvilProcess.stderr?.on('data', (chunk) => {
          currentStderr += chunk.toString();
        });

        // Wait for Anvil to become responsive (up to 20 attempts, 300ms each = 6s)
        let isHealthy = false;
        for (let attempt = 0; attempt < 20; attempt++) {
          if (anvilProcess.exitCode !== null) {
            lastErrorOutput = currentStderr || `Process exited with code ${anvilProcess.exitCode}`;
            break;
          }
          try {
            await jsonRpc(rpcUrl, 'eth_blockNumber', [], 1000);
            await jsonRpc(rpcUrl, 'eth_getStorageAt', [wethMainnetAddress, '0x0', 'latest'], 2000);
            // Only healthy if the node answering is the one we spawned
            isHealthy = anvilProcess.exitCode === null;
            break;
          } catch {
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
        }

        if (isHealthy) {
          break;
        } else {
          // Wait for exit so the port is released before the next candidate RPC is tried
          await stopProcess(anvilProcess);
          activeProcess = null;
          lastErrorOutput = currentStderr || lastErrorOutput;
        }
      }

      if (!activeProcess) {
        process.off('exit', killActive);
        throw new Error(
          `Anvil fork on port ${port} failed to become responsive on chain ${chainId}. Candidate RPCs tried: ${candidateRpcs.join(
            ', ',
          )}. Last error output:\n${lastErrorOutput}`,
        );
      }

      // Pre-fund test account with 1,000 ETH
      await jsonRpc(rpcUrl, 'anvil_setBalance', [defaultAnvilAddress, '0x3635C9ADC5DEA00000']);

      // Pre-seed known counterfactual Safe addresses so Anvil doesn't fail on undeployed accounts
      for (const safeAddress of [
        '0xe6Cc2735F7E97274f9ee8A194DC93f2aC3CAADC9',
        '0x70c84430c251256b3fba0316c046786e3e6be2bc',
      ]) {
        await jsonRpc(rpcUrl, 'anvil_setCode', [safeAddress, '0x']).catch(() => {});
      }

      await use({
        port,
        rpcUrl,
        chainId,
        process: activeProcess,
      });

      // Worker teardown: wait for Anvil to exit so its port is free for the next run/worker.
      // `killActive` stays as the sync fallback for abrupt process exits only.
      process.off('exit', killActive);
      await stopProcess(activeProcess);
    },
    { scope: 'worker' },
  ],

  // ---------------------------------------------------------------------------
  // Test-Scoped: EVM Snapshot before each test & EVM Revert after each test
  // Guarantees zero-pollution deterministic state resets
  // ---------------------------------------------------------------------------
  anvilFork: async ({ anvilServer, page }, use) => {
    // 1. Take baseline snapshot before test execution.
    // evm_revert consumes the snapshot it reverts to, so the baseline is re-taken
    // whenever a test reverts to it, keeping teardown's revert target valid.
    let baselineId = await jsonRpc<string>(anvilServer.rpcUrl, 'evm_snapshot', []);

    const controller: AnvilForkController = {
      port: anvilServer.port,
      rpcUrl: anvilServer.rpcUrl,
      chainId: anvilServer.chainId,
      get snapshotId() {
        return baselineId;
      },

      rpc: <T = unknown>(method: string, params: unknown[] = []) =>
        jsonRpc<T>(anvilServer.rpcUrl, method, params),

      snapshot: () => jsonRpc<string>(anvilServer.rpcUrl, 'evm_snapshot', []),

      revert: async (id?: string) => {
        const target = id || baselineId;
        const reverted = await jsonRpc<boolean>(anvilServer.rpcUrl, 'evm_revert', [target]);
        if (reverted && target === baselineId) {
          baselineId = await jsonRpc<string>(anvilServer.rpcUrl, 'evm_snapshot', []);
        }
        return reverted;
      },

      setBalance: async (address: string, etherAmount: number | bigint | string) => {
        await jsonRpc(anvilServer.rpcUrl, 'anvil_setBalance', [
          address,
          toHex(parseEther(String(etherAmount))),
        ]);
      },

      impersonateAccount: async (address: string) => {
        await jsonRpc(anvilServer.rpcUrl, 'anvil_impersonateAccount', [address]);
      },

      stopImpersonatingAccount: async (address: string) => {
        await jsonRpc(anvilServer.rpcUrl, 'anvil_stopImpersonatingAccount', [address]);
      },

      fundToken: async ({ tokenAddress, recipient, amount, whale, decimals }) => {
        const rpcUrl = anvilServer.rpcUrl;
        const token = tokenAddress as Address;
        const to = recipient as Address;
        const tokenDecimals = decimals ?? (await erc20Decimals(rpcUrl, token));
        const rawAmount = parseUnits(String(amount), tokenDecimals);
        const balanceBefore = await erc20BalanceOf(rpcUrl, token, to);

        if (token.toLowerCase() === wethMainnetAddress.toLowerCase()) {
          // Wrap the recipient's own ETH via WETH.deposit() (sent with --auto-impersonate)
          await sendAndConfirm(rpcUrl, {
            from: to,
            to: token,
            value: toHex(rawAmount),
            data: encodeFunctionData({ abi: wethDepositAbi, functionName: 'deposit' }),
          });
        } else {
          if (!whale) {
            throw new Error(
              `fundToken: pass a \`whale\` that holds ${tokenAddress}; only WETH can be minted without one.`,
            );
          }
          // Gas money for the whale, then transfer from it while impersonated
          await jsonRpc(rpcUrl, 'anvil_setBalance', [whale, toHex(parseEther('10'))]);
          await jsonRpc(rpcUrl, 'anvil_impersonateAccount', [whale]);
          try {
            await sendAndConfirm(rpcUrl, {
              from: whale,
              to: token,
              data: encodeFunctionData({
                abi: erc20Abi,
                functionName: 'transfer',
                args: [to, rawAmount],
              }),
            });
          } finally {
            await jsonRpc(rpcUrl, 'anvil_stopImpersonatingAccount', [whale]);
          }
        }

        // Some tokens return false instead of reverting, so confirm the balance really moved
        const balanceAfter = await erc20BalanceOf(rpcUrl, token, to);
        if (balanceAfter - balanceBefore !== rawAmount) {
          throw new Error(
            `fundToken: ${recipient} balance of ${tokenAddress} changed by ${balanceAfter - balanceBefore}, expected ${rawAmount}.`,
          );
        }
      },

      simulateRpcRateLimit: async () => {
        let hits = 0;
        const pattern = appRpcProxyPattern(anvilServer.chainId);
        const rateLimited = async (route: Route) => {
          hits++;
          await route.fulfill({
            status: 429,
            contentType: 'application/json',
            headers: { 'Retry-After': '60' },
            body: JSON.stringify({ error: 'Too many requests' }),
          });
        };
        // Registered after the fixture's forwarding route, so Playwright runs it first
        await page.route(pattern, rateLimited);
        return {
          hits: () => hits,
          // Lifts the rate limit; requests flow to Anvil again via the fixture's route
          stop: () => page.unroute(pattern, rateLimited),
        };
      },

      increaseTime: async (seconds: number) => {
        return await jsonRpc<number>(anvilServer.rpcUrl, 'evm_increaseTime', [seconds]);
      },

      mine: async (blocks = 1) => {
        await jsonRpc(anvilServer.rpcUrl, 'anvil_mine', [toHex(blocks)]);
      },
    };

    await use(controller);

    // 2. Revert back to baseline after test execution (instant state reset).
    // A failed revert would leak state into the next test, so it fails loudly.
    // Skipped only when the Anvil process is already gone (nothing left to pollute).
    if (anvilServer.process.exitCode !== null) {
      return;
    }
    const reverted = await jsonRpc<boolean>(anvilServer.rpcUrl, 'evm_revert', [baselineId]);
    if (!reverted) {
      throw new Error(
        `evm_revert to baseline snapshot ${baselineId} failed on port ${anvilServer.port}; ` +
          'chain state would leak into the next test.',
      );
    }
  },

  // ---------------------------------------------------------------------------
  // EIP-1193 Programmatic Controller Fixture
  // ---------------------------------------------------------------------------
  eip1193: async ({ page }, use) => {
    const controller: EIP1193Controller = {
      walletAddress: defaultAnvilAddress,

      mockRejectNext: async (val = true) => {
        await page.evaluate((v) => {
          (
            window as unknown as { __eip1193Control?: { setRejectNext: (b: boolean) => void } }
          ).__eip1193Control?.setRejectNext(v);
        }, val);
      },

      switchAccount: async (newAddress: string) => {
        await page.evaluate((addr) => {
          (
            window as unknown as { __eip1193Control?: { setAccounts: (a: string[]) => void } }
          ).__eip1193Control?.setAccounts([addr]);
        }, newAddress);
      },

      switchChain: async (newChainId: number | string) => {
        await page.evaluate((cid) => {
          (
            window as unknown as {
              __eip1193Control?: { setChainId: (c: number | string) => void };
            }
          ).__eip1193Control?.setChainId(cid);
        }, newChainId);
      },

      setConnected: async (val: boolean) => {
        await page.evaluate((v) => {
          (
            window as unknown as {
              __eip1193Control?: { setConnected: (b: boolean) => void };
            }
          ).__eip1193Control?.setConnected(v);
        }, val);
      },
    };

    await use(controller);
  },

  // ---------------------------------------------------------------------------
  // App Fixture: Injects EIP-1193 Mock Provider & Bridges Signatures to Node.js Viem
  // ---------------------------------------------------------------------------
  app: [
    async (
      // anvilFork is requested so every test gets a snapshot before and a revert after,
      // even when the test itself never touches the fork controller
      { page, anvilServer, anvilFork: _anvilFork, autoConnectWallet, termsSigned },
      use,
    ) => {
      // 1. Expose Node.js cryptographic signing binding to the browser page context
      await page.exposeFunction('__playwright_sign', async (method: string, params: unknown[]) => {
        const rawParams = Array.isArray(params) ? params : [params];

        if (method === 'personal_sign') {
          // Spec order is [message, address]; some libraries send the legacy [address, message]
          const [first, second] = rawParams;
          const [message, address] = isAddress(second) ? [first, second] : [second, first];

          const text = typeof message === 'string' ? message : '';
          return await signerFor(address).signMessage({
            message: text.startsWith('0x') ? { raw: text as `0x${string}` } : text,
          });
        }

        if (
          method === 'eth_signTypedData_v4' ||
          method === 'eth_signTypedData_v3' ||
          method === 'eth_signTypedData'
        ) {
          // [address, typedData]
          const [address, typedDataRaw] = rawParams;
          const typedData =
            typeof typedDataRaw === 'string' ? JSON.parse(typedDataRaw) : typedDataRaw;

          return await signerFor(address).signTypedData(typedData);
        }

        throw new Error(`[Playwright Signer] Unsupported method: ${method}`);
      });

      // 2. Inject compliant EIP-1193 & EIP-6963 provider into page context prior to script execution
      await page.addInitScript(
        createEIP1193Script({
          chainId: anvilServer.chainId,
          rpcUrl: anvilServer.rpcUrl,
          accounts: [defaultAnvilAddress],
          initiallyConnected: autoConnectWallet,
        }),
      );

      // 3. Route the forked chain's RPC traffic to this worker's Anvil node: the app's
      //    same-origin proxy (/api/rpc/<chainId>) plus well-known public RPCs for that chain.
      //    Other chains are not intercepted, so they never receive answers from the wrong chain.
      const forwardRpcToAnvil = createAnvilRpcHandler(anvilServer.rpcUrl);
      await page.route(appRpcProxyPattern(anvilServer.chainId), forwardRpcToAnvil);
      await page.route(walletConnectRpcPattern(anvilServer.chainId), forwardRpcToAnvil);

      const publicRpcPattern = publicRpcPatternFor(anvilServer.chainId);
      if (publicRpcPattern) {
        await page.route(publicRpcPattern, forwardRpcToAnvil);
      }

      // 5. Intercept terms status to guarantee deterministic terms approval in Anvil test environment
      await page.route('**/api/terms/status**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            enforced: true,
            signed: termsSigned,
            termsVersion: MOCK_TERMS_VERSION,
            termsHash: '0xmockedtermsapprovalforanviltesting',
          }),
        });
      });

      // 6. Intercept compliance geo check to report all product surfaces open in local dev/testing
      await page.route('**/api/compliance/geo**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            country: null,
            region: null,
            blockedSurfaces: [],
          }),
        });
      });

      // 7. Intercept compliance wallet screening so local dev requests pass clean
      await page.route('**/api/compliance/screen**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            screened: true,
            sanctioned: false,
            cached: true,
            logged: false,
          }),
        });
      });

      // 8. Intercept swap quotes to avoid third-party aggregator failures (1inch / 0x 401/503)
      await page.route('**/api/swap-quote**', async (route) => {
        let reqBody: Record<string, unknown> = {};
        try {
          reqBody = JSON.parse(route.request().postData() || '{}');
        } catch {
          // fallback
        }

        const amountInNetStr = (reqBody.amountInNet as string) || '1000000000000000000';
        const slippageBps = Number(reqBody.slippageBps) || 50;
        const providerId = (reqBody.providerId as string) || '1inch';

        let amountInNetBigInt = 1000000000000000000n;
        try {
          amountInNetBigInt = BigInt(amountInNetStr);
        } catch {
          // default
        }

        const amountOut = amountInNetBigInt > 0n ? amountInNetBigInt : 1000000000000000000n;
        const minAmountOut = (amountOut * BigInt(10000 - slippageBps)) / 10000n;

        // 1inch v6 router on Ethereum Mainnet
        const routerAddress = '0x111111125421cA6dc452d289314280a0f8842A65';

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            quote: {
              providerId,
              amountOut: amountOut.toString(),
              minAmountOut: minAmountOut.toString(),
              routerAddress,
              txData: '0x',
            },
          }),
        });
      });

      const app = new App(page);

      await app.open();
      await app.multiply.shouldBeOpened();

      if (autoConnectWallet) {
        await connectEip1193Wallet(app);
      }

      await use(app);

      // Must close here, not rely on Playwright's page teardown: `anvilFork` depends on `page`,
      // so the page would otherwise stay open (and keep firing RPC calls) while Anvil reverts.
      // Those calls queue slow upstream fork fetches that stall the next test's evm_snapshot.
      await app.page.close();
    },
    { timeout: TIMEOUTS.anvil.fixture },
  ],
});

export { expect } from '@playwright/test';
export { step } from './index';
