import { test, expect } from '@playwright/test';
import { productTableTopCardsSchema } from '../../utils/schema/api/productTableTopCardsSchema';
import { validateSchema } from '../../utils/schema/validator';
import type {
  ProductTableTopCardsResponse,
  TopCardsProductType,
} from '../../utils/types/api/productTableTopCards';
import '../../utils/assertions/matchers';
import { tc } from '../../utils/testCase';

interface ValidTopCardsCase {
  description: string;
  params: {
    productType: TopCardsProductType;
    filterId: string;
    protocols?: string;
  };
}

interface InvalidTopCardsCase {
  description: string;
  params?: Record<string, string>;
  expectedError: string;
}

const validTopCardsCases: ValidTopCardsCase[] = [
  {
    description: 'multiply lowest-cost',
    params: { productType: 'multiply', filterId: 'lowest-cost' },
  },
  {
    description: 'multiply highest-multiple',
    params: { productType: 'multiply', filterId: 'highest-multiple' },
  },
  {
    description: 'multiply most-liquidity',
    params: { productType: 'multiply', filterId: 'most-liquidity' },
  },
  {
    description: 'borrow highest-ltv',
    params: { productType: 'borrow', filterId: 'highest-ltv' },
  },
  {
    description: 'borrow lowest-borrow-rate',
    params: { productType: 'borrow', filterId: 'lowest-borrow-rate' },
  },
  {
    description: 'borrow most-liquidity',
    params: { productType: 'borrow', filterId: 'most-liquidity' },
  },
  {
    description: 'earn highest-current-apy with multi-protocol list',
    params: {
      productType: 'earn',
      filterId: 'highest-current-apy',
      protocols:
        'aaveV3,coinbase,compoundV3,ethena,etherfi,euler,fluid,lido,maple,rocketPool,sky,spark',
    },
  },
  {
    description: 'earn highest-current-apy with gauntlet and morpho',
    params: {
      productType: 'earn',
      filterId: 'highest-current-apy',
      protocols: 'gauntlet,morpho',
    },
  },
  {
    description: 'earn most-liquidity',
    params: { productType: 'earn', filterId: 'most-liquidity' },
  },
  {
    description: 'yieldLoop most-liquidity',
    params: { productType: 'yieldLoop', filterId: 'most-liquidity' },
  },
  {
    description: 'yieldLoop highest-apy',
    params: { productType: 'yieldLoop', filterId: 'highest-apy' },
  },
  {
    description: 'yieldLoop featured',
    params: { productType: 'yieldLoop', filterId: 'featured' },
  },
];

const invalidTopCardsCases: InvalidTopCardsCase[] = [
  {
    description: 'missing both productType and filterId',
    params: undefined,
    expectedError: 'Missing productType or filterId',
  },
  {
    description: 'missing filterId',
    params: { productType: 'multiply' },
    expectedError: 'Missing productType or filterId',
  },
  {
    description: 'missing productType',
    params: { filterId: 'lowest-cost' },
    expectedError: 'Missing productType or filterId',
  },
  {
    description: 'empty filterId',
    params: { productType: 'multiply', filterId: '' },
    expectedError: 'Missing productType or filterId',
  },
  {
    description: 'empty productType',
    params: { productType: '', filterId: 'lowest-cost' },
    expectedError: 'Missing productType or filterId',
  },
  {
    description: 'invalid productType string',
    params: { productType: 'invalid-product', filterId: 'lowest-cost' },
    expectedError: 'Invalid productType',
  },
  {
    description: 'unsupported productType (perps)',
    params: { productType: 'perps', filterId: 'some-filter-1' },
    expectedError: 'Invalid productType',
  },
  {
    description: 'invalid filterId string',
    params: { productType: 'multiply', filterId: 'invalid-filter' },
    expectedError: 'Invalid filterId',
  },
  {
    description: 'mismatched filterId for multiply (borrow highest-ltv)',
    params: { productType: 'multiply', filterId: 'highest-ltv' },
    expectedError: 'Invalid filterId',
  },
  {
    description: 'mismatched filterId for borrow (multiply lowest-cost)',
    params: { productType: 'borrow', filterId: 'lowest-cost' },
    expectedError: 'Invalid filterId',
  },
  {
    description: 'mismatched filterId for earn (multiply highest-multiple)',
    params: { productType: 'earn', filterId: 'highest-multiple' },
    expectedError: 'Invalid filterId',
  },
];

test.describe('Product Table Top Cards API', () => {
  for (const { description, params } of validTopCardsCases) {
    test(`should fetch top cards for ${description}`, tc('API-TOPC-001'), async ({ request }) => {
      const response = await request.get('/api/product-table/top-cards', { params });

      await expect(response).toHaveStatusCode(200);

      const headers = response.headers();
      expect(
        headers['content-type'],
        'Response content-type header should contain application/json',
      ).toContain('application/json');
      expect(
        headers['cache-control'],
        'Response cache-control header should be present',
      ).toBeDefined();

      const body: ProductTableTopCardsResponse = await response.json();
      await validateSchema({ schema: productTableTopCardsSchema, json: body });

      expect(Array.isArray(body.cards), 'Response should return an array of cards').toBe(true);
      expect(body.cards.length, 'Response should return at least one top card').toBeGreaterThan(0);
      expect(body.cards.length, 'Response should return at most 4 top cards').toBeLessThanOrEqual(
        4,
      );

      for (const card of body.cards) {
        expect(card.id, 'Card id should start with filterId').toMatch(
          new RegExp(`^${params.filterId}-`),
        );
        expect(card.title, 'Card title should not be empty').toBeTruthy();
        expect(
          card.tokens.length,
          `Card ${card.id} should have at least one token`,
        ).toBeGreaterThan(0);
        expect(card.url, `Card ${card.id} URL should start with /products/`).toMatch(
          /^\/products\//,
        );
      }
    });
  }

  test(
    'should ignore extra unexpected query parameter and return 200',
    tc('API-TOPC-002'),
    async ({ request }) => {
      const response = await request.get('/api/product-table/top-cards', {
        params: {
          productType: 'multiply',
          filterId: 'lowest-cost',
          extraParam: 'foo',
        },
      });

      await expect(response).toHaveStatusCode(200);

      const body: ProductTableTopCardsResponse = await response.json();
      await validateSchema({ schema: productTableTopCardsSchema, json: body });
      expect(
        body.cards.length,
        'Should return top cards even with extra parameter',
      ).toBeGreaterThan(0);
    },
  );

  for (const { description, params, expectedError } of invalidTopCardsCases) {
    test(
      `should return 400 bad request when ${description}`,
      tc('API-TOPC-003'),
      async ({ request }) => {
        const response = await request.get(
          '/api/product-table/top-cards',
          params ? { params } : undefined,
        );

        await expect(response).toHaveStatusCode(400);

        const body = await response.json();
        expect(body).toEqual({ error: expectedError });
      },
    );
  }

  const unsupportedMethods = ['post', 'put', 'delete', 'patch'] as const;

  for (const method of unsupportedMethods) {
    test(
      `should return 405 method not allowed for ${method.toUpperCase()} request`,
      tc('API-TOPC-004'),
      async ({ request }) => {
        const response = await request[method]('/api/product-table/top-cards');

        await expect(response).toHaveStatusCode(405);
      },
    );
  }
});
