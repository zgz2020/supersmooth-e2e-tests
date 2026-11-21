/**
 * Fixtures for the full-stack suite (tests/e2e/fullstack), run by `pnpm test:fullstack`.
 *
 * The app, its server, the indexer and the chain are all real and local (scripts/fullstack/run.js).
 * Isolation comes from a FRESH ACCOUNT PER TEST, not from snapshot/revert: the indexer cannot follow
 * a chain that is rewound under it, so tests never rewind. A generated account owns its own Safe and
 * positions, so tests cannot see each other's state, even in parallel on the same chain.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { test as base, type Page } from '@playwright/test';
import {
  encodeFunctionData,
  erc20Abi,
  parseEther,
  parseUnits,
  toHex,
  type Address,
  type Hex,
  type PrivateKeyAccount,
} from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { App } from '../app';
import { Stack } from '../stack';
import { createEIP1193Script } from './mockProvider';
import { wethMainnetAddress } from '../../utils/constants/addresses';
import {
  FULLSTACK_PONDER_URL,
  FULLSTACK_RPC_URL,
  erc20Balance,
  indexedBlock,
  readContract,
  rpc,
  sendAndConfirm,
} from '../../utils/fullStack';

const STACK_HINT =
  'Start it with `pnpm fullstack:up`, or run the suite with `pnpm test:fullstack`.';

export type TestWallet = {
  address: Address;
  account: PrivateKeyAccount;
  /** Hashes of every transaction the app sent through the wallet, in order. */
  sentTransactions: Hex[];
  /**
   * Gives the wallet `amount` (whole units) of `token`. WETH is wrapped from the wallet's own ETH;
   * any other token is transferred from `holder`, an account that holds enough of it (a protocol
   * adapter's `holderOf` names one). Asserts the balance really moved.
   */
  fund(token: Address, amount: number, holder?: Address): Promise<void>;
};

type WorkerFixtures = {
  /**
   * The layers below the UI (app database, chain, indexer), each with `should…` checks. Fails fast
   * with a clear message when the local stack is not up.
   */
  stack: Stack;
};

type TestFixtures = {
  wallet: TestWallet;
  app: App;
};

const isAddress = (value: unknown): value is string =>
  typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value);

// Cross-worker locks (workers are separate processes): one directory per lock, created atomically
const LOCK_DIR = path.resolve('.temp/fullstack/locks');
// A lock older than this was left by a crashed worker; funding itself takes a few seconds
const STALE_LOCK_MS = 120_000;

/** Runs `fn` while holding the lock `name`, shared by every worker on this machine. */
async function withLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const lock = path.join(LOCK_DIR, name);
  await fs.mkdir(LOCK_DIR, { recursive: true });
  for (;;) {
    try {
      await fs.mkdir(lock);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const stat = await fs.stat(lock).catch(() => null);
      if (stat && Date.now() - stat.mtimeMs > STALE_LOCK_MS) {
        await fs.rm(lock, { recursive: true, force: true });
      } else {
        await sleep(250);
      }
    }
  }
  try {
    return await fn();
  } finally {
    await fs.rm(lock, { recursive: true, force: true });
  }
}

/**
 * Transfers `raw` of `token` from `holder` while impersonating it. Locked per holder: another
 * worker's `anvil_stopImpersonatingAccount` would otherwise cut this transfer off mid-way.
 */
async function transferFromHolder(token: Address, holder: Address, to: Address, raw: bigint) {
  await withLock(`holder-${holder.toLowerCase()}`, async () => {
    // Gas money for the holder (it may be a contract), added to whatever it already holds
    const balance = BigInt(await rpc<Hex>('eth_getBalance', [holder, 'latest']));
    await rpc('anvil_setBalance', [holder, toHex(balance + parseEther('1'))]);
    await rpc('anvil_impersonateAccount', [holder]);
    try {
      await sendAndConfirm({
        from: holder,
        to: token,
        data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [to, raw] }),
      });
    } finally {
      await rpc('anvil_stopImpersonatingAccount', [holder]);
    }
  });
}

async function fundWallet(wallet: Address, token: Address, amount: number, holder?: Address) {
  const decimals = await readContract<number>(token, erc20Abi, 'decimals');
  const raw = parseUnits(String(amount), decimals);
  const before = await erc20Balance(token, wallet);

  if (token.toLowerCase() === wethMainnetAddress.toLowerCase()) {
    await sendAndConfirm({
      from: wallet,
      to: token,
      value: toHex(raw),
      data: '0xd0e30db0', // WETH.deposit()
    });
  } else {
    if (!holder)
      throw new Error(`wallet.fund: pass a holder of ${token}; only WETH can be wrapped`);
    await transferFromHolder(token, holder, wallet, raw);
  }

  // Some tokens return false instead of reverting, so confirm the balance really moved
  const received = (await erc20Balance(token, wallet)) - before;
  if (received !== raw) {
    throw new Error(`wallet.fund: received ${received} of ${token}, expected ${raw}`);
  }
}

/** Injects the EIP-1193 wallet for `wallet`: reads/sends go to the fork, signing happens in Node. */
async function installWallet(page: Page, wallet: TestWallet) {
  await page.exposeFunction('__playwright_sign', async (method: string, params: unknown) => {
    const args = Array.isArray(params) ? params : [params];
    if (method === 'personal_sign') {
      // Spec order is [message, address]; some libraries send [address, message]
      const message = String(isAddress(args[1]) ? args[0] : args[1]);
      return wallet.account.signMessage({
        message: message.startsWith('0x') ? { raw: message as Hex } : message,
      });
    }
    if (method.startsWith('eth_signTypedData')) {
      const typedData = typeof args[1] === 'string' ? JSON.parse(args[1]) : args[1];
      return wallet.account.signTypedData(typedData);
    }
    throw new Error(`[fullstack wallet] Unsupported signing method: ${method}`);
  });

  await page.addInitScript(
    createEIP1193Script({
      chainId: 1,
      rpcUrl: FULLSTACK_RPC_URL,
      accounts: [wallet.address],
      initiallyConnected: true,
    }),
  );

  // Record what the wallet broadcasts, so tests can assert each transaction on chain
  page.on('requestfinished', async (request) => {
    if (!request.url().startsWith(FULLSTACK_RPC_URL)) return;
    let body: { method?: string } | null = null;
    try {
      body = request.postDataJSON() as { method?: string } | null;
    } catch {
      return; // not a JSON-RPC body
    }
    if (body?.method !== 'eth_sendTransaction') return;
    const json = (await (await request.response())?.json().catch(() => null)) as {
      result?: Hex;
    } | null;
    if (json?.result) wallet.sentTransactions.push(json.result);
  });
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  stack: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const chainId = await rpc<Hex>('eth_chainId').catch(() => null);
      if (chainId !== '0x1') {
        throw new Error(`No mainnet fork at ${FULLSTACK_RPC_URL}. ${STACK_HINT}`);
      }
      if ((await indexedBlock()) === 0) {
        throw new Error(`Indexer not reachable at ${FULLSTACK_PONDER_URL}. ${STACK_HINT}`);
      }
      await use(new Stack());
    },
    { scope: 'worker', auto: true },
  ],

  // eslint-disable-next-line no-empty-pattern
  wallet: async ({}, use) => {
    const account = privateKeyToAccount(generatePrivateKey());
    const wallet: TestWallet = {
      address: account.address,
      account,
      sentTransactions: [],
      fund: (token, amount, holder) => fundWallet(account.address, token, amount, holder),
    };

    // Gas money. Impersonation lets the fork accept the wallet's eth_sendTransaction without a
    // raw signature. Tokens are funded per test, for whatever the test deposits (`wallet.fund`).
    await rpc('anvil_setBalance', [account.address, toHex(parseEther('100'))]);
    await rpc('anvil_impersonateAccount', [account.address]);

    await use(wallet);

    await rpc('anvil_stopImpersonatingAccount', [account.address]);
  },

  app: async ({ page, wallet }, use) => {
    await installWallet(page, wallet);

    // Compliance checks call third-party screening services, which are not part of the stack
    // under test: report a clean, unrestricted user. Terms of Service are NOT mocked: the app's
    // server verifies the real signature.
    await page.route('**/api/compliance/geo**', (route) =>
      route.fulfill({ json: { country: null, region: null, blockedSurfaces: [] } }),
    );
    await page.route('**/api/compliance/screen**', (route) =>
      route.fulfill({ json: { screened: true, sanctioned: false, cached: true, logged: false } }),
    );

    await use(new App(page));
  },
});

export { expect } from '@playwright/test';
