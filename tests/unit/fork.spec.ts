import { test, expect } from '@playwright/test';
import {
  checkNewPin,
  parseBlockNumber,
  PINNED_FORK_BLOCKS,
  resolveForkBlock,
  servesStateAt,
} from '../../utils/constants/fork';

/** Unit tests for resolveForkBlock: which block an Anvil fork starts at (no network). */
const pins = { '1': 21_000_000 };

test.describe('resolveForkBlock', () => {
  test('uses the chain pin when there is no override', () => {
    expect(resolveForkBlock(1, undefined, pins)).toBe(21_000_000);
    expect(resolveForkBlock(1, '', pins)).toBe(21_000_000);
    expect(resolveForkBlock(1, '  ', pins)).toBe(21_000_000);
  });

  test('forks the latest block for a chain with no pin', () => {
    expect(resolveForkBlock(8453, undefined, pins)).toBeNull();
  });

  test('a block number override wins over the pin', () => {
    expect(resolveForkBlock(1, '22000000', pins)).toBe(22_000_000);
  });

  test('"latest" forks the live chain head', () => {
    expect(resolveForkBlock(1, 'latest', pins)).toBeNull();
    expect(resolveForkBlock(1, 'LATEST', pins)).toBeNull();
  });

  test('rejects an override that is not a block number', () => {
    expect(() => resolveForkBlock(1, 'abc', pins)).toThrow(
      /Invalid block number "abc": use a block number or "latest"/,
    );
    expect(() => resolveForkBlock(1, '-5', pins)).toThrow(/Invalid block number/);
    expect(() => resolveForkBlock(1, '1.5', pins)).toThrow(/Invalid block number/);
  });

  test('forkBlocks.json pins every chain to a positive block number', () => {
    expect(Object.keys(PINNED_FORK_BLOCKS)).toContain('1');
    for (const block of Object.values(PINNED_FORK_BLOCKS)) {
      expect(Number.isSafeInteger(block) && block > 0).toBe(true);
    }
  });
});

test.describe('parseBlockNumber', () => {
  test('accepts a positive whole block number', () => {
    expect(parseBlockNumber('26490783')).toBe(26_490_783);
  });

  test('rejects anything else', () => {
    for (const value of ['0', '-1', '1.5', '1e6', '0x10', 'abc', '']) {
      expect(() => parseBlockNumber(value), value).toThrow(/^Invalid block number/);
    }
  });
});

test.describe('checkNewPin (pnpm anvil:move-pin)', () => {
  test('accepts a finalized block newer than the current pin', () => {
    expect(checkNewPin({ block: 110, finalized: 120, current: 100 })).toEqual({ warnings: [] });
  });

  test('accepts the latest finalized block itself, and a first pin', () => {
    expect(checkNewPin({ block: 120, finalized: 120, current: null })).toEqual({ warnings: [] });
  });

  test('rejects a block that is not finalized yet', () => {
    expect(checkNewPin({ block: 121, finalized: 120, current: 100 }).error).toMatch(
      /not finalized yet \(latest finalized: 120\)/,
    );
  });

  test('rejects the block that is already the pin', () => {
    expect(checkNewPin({ block: 100, finalized: 120, current: 100 }).error).toMatch(
      /already the pin/,
    );
  });

  test('warns when moving the pin back to an older block', () => {
    const { error, warnings } = checkNewPin({ block: 90, finalized: 120, current: 100 });
    expect(error).toBeUndefined();
    expect(warnings).toEqual([expect.stringMatching(/older than the current pin \(100\)/)]);
  });
});

test.describe('servesStateAt (fake fetch, no network)', () => {
  const realFetch = globalThis.fetch;

  test.afterEach(() => {
    globalThis.fetch = realFetch;
  });

  const fakeFetch = (reply: () => Promise<Response>) => {
    const calls: unknown[] = [];
    globalThis.fetch = ((_url: string, init: { body: string }) => {
      calls.push(JSON.parse(init.body));
      return reply();
    }) as unknown as typeof fetch;
    return calls;
  };
  const json = (body: unknown, status = 200) =>
    Promise.resolve(new Response(JSON.stringify(body), { status }));

  test('true when the RPC returns state at the block, asked for in hex', async () => {
    const calls = fakeFetch(() => json({ jsonrpc: '2.0', id: 1, result: '0x1' }));
    expect(await servesStateAt('https://rpc.example', 255)).toBe(true);
    expect(calls).toEqual([
      expect.objectContaining({
        method: 'eth_getBalance',
        params: ['0x0000000000000000000000000000000000000000', '0xff'],
      }),
    ]);
  });

  test('false when the RPC refuses old state (e.g. archive behind a token)', async () => {
    fakeFetch(() =>
      json({
        jsonrpc: '2.0',
        id: 1,
        error: { code: -32602, message: 'Archive requests require a personal token' },
      }),
    );
    expect(await servesStateAt('https://rpc.example', 255)).toBe(false);
  });

  test('false on an HTTP error or a network failure, without throwing', async () => {
    fakeFetch(() => json({}, 503));
    expect(await servesStateAt('https://rpc.example', 255)).toBe(false);
    fakeFetch(() => Promise.reject(new Error('ECONNREFUSED')));
    expect(await servesStateAt('https://rpc.example', 255)).toBe(false);
  });
});
