import { test, expect } from '@playwright/test';
import { tokenPricesCurrentSchema } from '../../utils/schema/api/tokenPricesCurrentSchema';
import { validateSchema } from '../../utils/schema/validator';
import type { TokenPricesCurrentResponse } from '../../utils/types/api/tokenPricesCurrent';
import '../../utils/assertions/matchers';
import { tc } from '../../utils/testCase';

function assertPriceSanity(prices: Record<string, number>): void {
  expect(
    Object.keys(prices).length,
    'Prices dictionary should contain at least one entry',
  ).toBeGreaterThan(0);
  for (const [coin, price] of Object.entries(prices)) {
    expect(Number.isFinite(price), `Price for ${coin} must be finite`).toBe(true);
    expect(price, `Price for ${coin} must be strictly positive`).toBeGreaterThan(0);
    expect(Number.isNaN(price), `Price for ${coin} must not be NaN`).toBe(false);
  }
}

test.describe('Token Prices Current API', () => {
  test(
    'should fetch token prices current without params',
    tc('API-PRICE-001'),
    async ({ request }) => {
      const response = await request.get('/api/token-prices/current');

      await expect(response).toHaveStatusCode(200);

      const body: TokenPricesCurrentResponse = await response.json();
      await validateSchema({ schema: tokenPricesCurrentSchema, json: body });
    },
  );

  test(
    'should fetch current token prices for requested coins',
    tc('API-PRICE-002'),
    async ({ request }) => {
      const coins = [
        'ethereum:0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        'ethereum:0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
        'ethereum:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      ].join(',');

      const response = await request.get('/api/token-prices/current', {
        params: { coins },
      });

      await expect(response).toHaveStatusCode(200);

      const body: TokenPricesCurrentResponse = await response.json();
      await validateSchema({ schema: tokenPricesCurrentSchema, json: body });
      expect(
        Object.keys(body.prices).length,
        'Response prices object should contain price entries for requested coins',
      ).toBeGreaterThan(0);
      assertPriceSanity(body.prices);
    },
  );

  test(
    'should fetch token prices across multiple chains',
    tc('API-PRICE-003'),
    async ({ request }) => {
      const coins = [
        'ethereum:0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        'base:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      ].join(',');

      const response = await request.get('/api/token-prices/current', {
        params: { coins },
      });

      await expect(response).toHaveStatusCode(200);

      const body: TokenPricesCurrentResponse = await response.json();
      await validateSchema({ schema: tokenPricesCurrentSchema, json: body });
      assertPriceSanity(body.prices);

      for (const coinKey of coins.split(',')) {
        expect(typeof body.prices[coinKey], `Price for ${coinKey} should be a number`).toBe(
          'number',
        );
      }
    },
  );

  test(
    'should handle lowercase coin address in query parameter',
    tc('API-PRICE-004'),
    async ({ request }) => {
      const lowercaseCoin = 'ethereum:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';

      const response = await request.get('/api/token-prices/current', {
        params: { coins: lowercaseCoin },
      });

      await expect(response).toHaveStatusCode(200);

      const body: TokenPricesCurrentResponse = await response.json();
      await validateSchema({ schema: tokenPricesCurrentSchema, json: body });
      expect(
        typeof body.prices[lowercaseCoin],
        'Price for lowercase address should be a number',
      ).toBe('number');
      assertPriceSanity(body.prices);
    },
  );

  test(
    'should ignore extra unexpected query parameter and return 200',
    tc('API-PRICE-005'),
    async ({ request }) => {
      const response = await request.get('/api/token-prices/current', {
        params: {
          coins: 'ethereum:0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
          extraParam: 'foo',
        },
      });

      await expect(response).toHaveStatusCode(200);

      const body: TokenPricesCurrentResponse = await response.json();
      await validateSchema({ schema: tokenPricesCurrentSchema, json: body });
      assertPriceSanity(body.prices);
    },
  );

  test(
    'should return empty prices object when coins parameter is malformed',
    tc('API-PRICE-006'),
    async ({ request }) => {
      const response = await request.get('/api/token-prices/current', {
        params: { coins: 'invalid-coin-key' },
      });

      await expect(response).toHaveStatusCode(200);

      const body: TokenPricesCurrentResponse = await response.json();
      await validateSchema({ schema: tokenPricesCurrentSchema, json: body });
      expect(body.prices, 'Prices object should be empty for malformed coin parameter').toEqual({});
    },
  );

  const unsupportedMethods = ['post', 'put', 'delete', 'patch'] as const;

  for (const method of unsupportedMethods) {
    test(
      `should return 405 method not allowed for ${method.toUpperCase()} request`,
      tc('API-PRICE-007'),
      async ({ request }) => {
        const response = await request[method]('/api/token-prices/current');

        await expect(response).toHaveStatusCode(405);
      },
    );
  }
});
