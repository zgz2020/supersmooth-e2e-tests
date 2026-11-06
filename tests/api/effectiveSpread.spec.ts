import { test, expect } from '@playwright/test';
import { NETWORK_CHAIN_IDS } from '../../utils/constants/networks';
import { effectiveSpreadSchema } from '../../utils/schema/api/effectiveSpreadSchema';
import { validateSchema } from '../../utils/schema/validator';
import type {
  EffectiveSpreadProduct,
  EffectiveSpreadResponse,
} from '../../utils/types/api/effectiveSpread';
import '../../utils/assertions/matchers';

function assertSpreadSanity(spreadBps: number | null, network: string, product: string): void {
  if (spreadBps !== null) {
    expect(
      Number.isFinite(spreadBps),
      `Effective spread for ${product} on ${network} must be finite`,
    ).toBe(true);
    expect(
      spreadBps,
      `Effective spread for ${product} on ${network} must be non-negative`,
    ).toBeGreaterThanOrEqual(0);
  }
}

const products: EffectiveSpreadProduct[] = ['borrow', 'multiply', 'yieldLoop'];

test.describe('Effective Spread API', () => {
  for (const [network, chainId] of Object.entries(NETWORK_CHAIN_IDS)) {
    for (const product of products) {
      test(`should fetch effective spread for network ${network} (chainId=${chainId}) and product ${product}`, async ({
        request,
      }) => {
        const response = await request.get('/api/effective-spread', {
          params: {
            chainId,
            product,
          },
        });

        await expect(response).toHaveStatusCode(200);

        const body: EffectiveSpreadResponse = await response.json();
        await validateSchema({ schema: effectiveSpreadSchema, json: body });
        assertSpreadSanity(body.spreadBps, network, product);
      });
    }
  }

  const invalidChainIdCases: Array<{ description: string; params?: Record<string, string> }> = [
    { description: 'missing', params: { product: 'borrow' } },
    { description: 'empty', params: { chainId: '', product: 'borrow' } },
    { description: 'invalid string', params: { chainId: 'invalid-chain', product: 'borrow' } },
    { description: 'short hex', params: { chainId: '0x123', product: 'borrow' } },
    { description: 'unsupported numeric chain', params: { chainId: '99999', product: 'borrow' } },
  ];

  for (const { description, params } of invalidChainIdCases) {
    test(`should return 400 bad request when chainId is ${description}`, async ({ request }) => {
      const response = await request.get('/api/effective-spread', { params });

      await expect(response).toHaveStatusCode(400);

      const body = await response.json();
      expect(body).toEqual({
        error: 'A valid, supported chainId query param is required',
      });
    });
  }

  const invalidProductCases: Array<{ description: string; params: Record<string, string> }> = [
    { description: 'missing', params: { chainId: '8453' } },
    { description: 'empty', params: { chainId: '8453', product: '' } },
    { description: 'invalid string', params: { chainId: '8453', product: 'invalid-product' } },
    { description: 'unsupported', params: { chainId: '8453', product: 'earn' } },
  ];

  for (const { description, params } of invalidProductCases) {
    test(`should return 400 bad request when product is ${description}`, async ({ request }) => {
      const response = await request.get('/api/effective-spread', { params });

      await expect(response).toHaveStatusCode(400);

      const body = await response.json();
      expect(body).toEqual({
        error: 'product must be one of borrow, multiply, yieldLoop',
      });
    });
  }

  test('should ignore extra unexpected query parameter and return 200', async ({ request }) => {
    const response = await request.get('/api/effective-spread', {
      params: {
        chainId: '8453',
        product: 'borrow',
        extraParam: 'foo',
      },
    });

    await expect(response).toHaveStatusCode(200);

    const body: EffectiveSpreadResponse = await response.json();
    await validateSchema({ schema: effectiveSpreadSchema, json: body });
  });

  test('should return 405 method not allowed for POST request', async ({ request }) => {
    const response = await request.post('/api/effective-spread');

    await expect(response).toHaveStatusCode(405);
  });
});
