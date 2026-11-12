import { test, expect, type APIRequestContext } from '@playwright/test';
import { getActiveVault } from '../../utils/getActiveVault';
import { FALLBACK_MARKETS, vaultPath } from '../../utils/constants/urls';

/**
 * Unit tests for getActiveVault, against a fake APIRequestContext (no network, no browser).
 * Fixtures mirror real staging responses, so each step and fallback is exercised deterministically.
 */

// Real Base multiply markets (staging, 2026-11) and their collateral
const BASE = {
  cbBtc: '0x9103c3b4e834476c9a62ea009ba2c884ee42e94e6e314a26f04d312434191836',
  wstEth: '0x13c42741a359ac4a8aa8287d2be109dcf28344484f91185f9a79bd5a805a55ae',
  cbEth: '0x0ca10126f6c94cbd9cf0a48cc9516ae5e3dec5aa68303e6d988ee37c5149bf0d',
  weth: FALLBACK_MARKETS.morphoEthBase,
};
const PRODUCT_DETAIL_COLLATERAL: Record<string, string> = {
  [BASE.cbBtc]: 'cbBTC',
  [BASE.wstEth]: 'wstETH',
  [BASE.cbEth]: 'cbETH',
  [BASE.weth]: 'WETH',
  [FALLBACK_MARKETS.sparkWethUsdsEthereum]: 'WETH',
  '0xspark-cbbtc': 'cbBTC',
};

interface TopCard {
  title: string;
  network: string;
  protocol: string;
  tokens: string[];
  url: string;
}

interface FakeApi {
  topCards?: TopCard[] | 'error';
  /** Products catalog HTML; 'error' answers 500 */
  catalogHtml?: string | 'error';
  /** Market ids for which /api/product-detail fails */
  failingDetails?: string[];
}

interface Call {
  url: string;
  params?: Record<string, string | number | boolean>;
}

function fakeRequest(api: FakeApi): { request: APIRequestContext; calls: Call[] } {
  const calls: Call[] = [];
  const respond = (status: number, body: unknown) => ({
    ok: () => status >= 200 && status < 300,
    status: () => status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  });

  const get = async (url: string, options?: { params?: Record<string, string> }) => {
    calls.push({ url, params: options?.params });

    if (url.startsWith('/api/product-table/top-cards')) {
      return api.topCards === 'error'
        ? respond(500, {})
        : respond(200, { cards: api.topCards ?? [] });
    }
    if (url.startsWith('/products/')) {
      return api.catalogHtml === 'error' ? respond(500, '') : respond(200, api.catalogHtml ?? '');
    }
    if (url.startsWith('/api/product-detail')) {
      const marketId = String(options?.params?.marketIdentifier);
      if (api.failingDetails?.includes(marketId)) return respond(500, {});
      const collateral = PRODUCT_DETAIL_COLLATERAL[marketId];
      return respond(200, {
        isExactMatch: !!collateral,
        product: collateral ? { collateral_token: collateral, debt_token: 'USDC' } : null,
      });
    }
    return respond(404, {});
  };

  return { request: { get } as unknown as APIRequestContext, calls };
}

/** Catalog HTML the way the products page renders it: links, with token labels NOT reliably parseable */
const catalog = (...paths: string[]) =>
  paths.map((p) => `<a href="${p}"><div class="row">…</div></a>`).join('\n');

const baseMultiply = (marketId: string) => vaultPath('multiply', 'morpho', 8453, marketId);

const stagingTopCards: TopCard[] = [
  {
    title: 'cbBTC/USDC',
    network: 'base',
    protocol: 'morpho',
    tokens: ['cbBTC', 'USDC'],
    url: baseMultiply(BASE.cbBtc),
  },
  {
    title: 'cbBTC/USDS',
    network: 'ethereum',
    protocol: 'spark',
    tokens: ['cbBTC', 'USDS'],
    url: vaultPath('multiply', 'spark', 1, '0xspark-cbbtc'),
  },
];

test.describe('getActiveVault', () => {
  test('returns the matching top card without querying the catalog', async () => {
    const { request, calls } = fakeRequest({ topCards: stagingTopCards });

    const vault = await getActiveVault(request, 'multiply', {
      network: 'Base',
      collateral: 'cbBTC',
    });

    expect(vault).toMatchObject({ url: baseMultiply(BASE.cbBtc), collateral: 'cbBTC' });
    expect(calls.map((c) => c.url)).toEqual(['/api/product-table/top-cards']);
  });

  test('never returns a vault with the wrong collateral (nightly cbBTC regression)', async () => {
    // No ETH top card on Base; the catalog lists the cbBTC top-card link first, then ETH-like vaults
    const { request, calls } = fakeRequest({
      topCards: stagingTopCards,
      catalogHtml: catalog(
        baseMultiply(BASE.cbBtc),
        baseMultiply(BASE.wstEth),
        baseMultiply(BASE.cbEth),
        baseMultiply(BASE.weth),
      ),
    });

    const vault = await getActiveVault(request, 'multiply', { network: 'Base', collateral: 'ETH' });

    expect(vault).toMatchObject({ url: baseMultiply(BASE.weth), collateral: 'ETH' });
    // Uses the app's own filters, and confirms collateral per candidate until one matches
    expect(calls).toContainEqual({ url: '/products/multiply?network=base&deposit=ETH' });
    const checked = calls
      .filter((c) => c.url === '/api/product-detail')
      .map((c) => c.params?.marketIdentifier);
    expect(checked).toEqual([BASE.cbBtc, BASE.wstEth, BASE.cbEth, BASE.weth]);
  });

  test('falls back to the canonical vault when no catalog candidate is confirmed', async () => {
    const { request } = fakeRequest({
      topCards: stagingTopCards,
      catalogHtml: catalog(baseMultiply(BASE.cbBtc), baseMultiply(BASE.weth)),
      failingDetails: [BASE.weth],
    });

    const vault = await getActiveVault(request, 'multiply', { network: 'Base', collateral: 'ETH' });

    expect(vault).toMatchObject({
      url: vaultPath('multiply', 'morpho', 8453, FALLBACK_MARKETS.morphoEthBase),
      collateral: 'ETH',
      protocol: 'morpho',
    });
  });

  test('falls back when the APIs are down', async () => {
    const { request } = fakeRequest({ topCards: 'error', catalogHtml: 'error' });

    const vault = await getActiveVault(request, 'borrow', {
      network: 'Ethereum',
      collateral: 'ETH',
    });

    expect(vault.url).toBe(vaultPath('borrow', 'spark', 1, FALLBACK_MARKETS.sparkWethUsdsEthereum));
  });

  test('earn and yield loop skip the unverifiable catalog and use matching fallbacks', async () => {
    const { request, calls } = fakeRequest({
      topCards: [],
      catalogHtml: catalog('/products/earn/morpho/8453/0xwrong'),
    });

    const coinbase = await getActiveVault(request, 'earn', {
      network: 'Base',
      protocols: 'coinbase',
      collateral: 'cbETH',
    });
    const morpho = await getActiveVault(request, 'earn', {
      network: 'Base',
      protocols: 'morpho',
      collateral: 'USDC',
    });
    const yieldLoop = await getActiveVault(request, 'yieldLoop', {
      network: 'Base',
      collateral: 'wstETH',
    });

    expect(coinbase).toMatchObject({ protocol: 'coinbase', collateral: 'cbETH' });
    expect(morpho).toMatchObject({ protocol: 'morpho', collateral: 'USDC' });
    expect(yieldLoop).toMatchObject({ protocol: 'morpho', collateral: 'wstETH' });
    expect(calls.some((c) => c.url.startsWith('/products/'))).toBe(false);
  });

  test('respects the protocols filter when choosing catalog candidates', async () => {
    const { request, calls } = fakeRequest({
      topCards: [],
      catalogHtml: catalog(
        vaultPath('multiply', 'morpho', 1, '0xmorpho-weth'),
        vaultPath('multiply', 'spark', 1, FALLBACK_MARKETS.sparkWethUsdsEthereum),
      ),
    });

    const vault = await getActiveVault(request, 'multiply', {
      network: 'Ethereum',
      collateral: 'ETH',
      protocols: 'spark',
    });

    expect(vault.protocol).toBe('spark');
    const checked = calls
      .filter((c) => c.url === '/api/product-detail')
      .map((c) => c.params?.protocol);
    expect(checked).toEqual(['spark']);
  });

  test('throws instead of returning a vault when no collateral matches', async () => {
    const { request } = fakeRequest({
      topCards: stagingTopCards,
      catalogHtml: catalog(baseMultiply(BASE.cbBtc), baseMultiply(BASE.weth)),
    });

    await expect(
      getActiveVault(request, 'multiply', { network: 'Base', collateral: 'DOGE' }),
    ).rejects.toThrow(
      'No active vaults found for productType=multiply, network=Base, collateral=DOGE',
    );
  });
});
