import { test, expect } from '@playwright/test';
import { portfolioSummarySchema } from '../../utils/schema/api/portfolioSummarySchema.js';
import { validateSchema } from '../../utils/schema/validator.js';
import type { PortfolioSummaryResponse } from '../../utils/types/api/portfolioSummary.js';
import { validAddress, zeroAddress, invalidAddressCases } from '../../utils/constants/addresses.js';
import '../../utils/assertions/matchers.js';

test.describe('Portfolio Summary API', () => {
  test('should fetch portfolio summary regardless of address casing', async ({ request }) => {
    const checksummedBody = await test.step('Fetch and validate checksummed address', async () => {
      const response = await request.get('/api/portfolio/summary', {
        params: {
          address: validAddress,
        },
      });
      await expect(response).toHaveStatusCode(200);

      const body: PortfolioSummaryResponse = await response.json();
      await validateSchema({ schema: portfolioSummarySchema, json: body });
      expect(
        body.chainBreakdown.length,
        'Valid wallet address should return at least one chain breakdown item',
      ).toBeGreaterThan(0);

      return body;
    });

    await test.step('Fetch lowercase address and verify parity with checksummed response', async () => {
      const response = await request.get('/api/portfolio/summary', {
        params: {
          address: validAddress.toLowerCase(),
        },
      });
      await expect(response).toHaveStatusCode(200);

      const lowercaseBody: PortfolioSummaryResponse = await response.json();
      expect(
        lowercaseBody,
        'Lowercase address response should match checksummed address response',
      ).toEqual(checksummedBody);
    });
  });

  test('should fetch portfolio summary for address with zero balance', async ({ request }) => {
    const targetAddress = zeroAddress;

    const response = await request.get('/api/portfolio/summary', {
      params: {
        address: targetAddress,
      },
    });

    await expect(response).toHaveStatusCode(200);

    const body: PortfolioSummaryResponse = await response.json();
    await validateSchema({ schema: portfolioSummarySchema, json: body });
  });

  for (const { description, params } of invalidAddressCases) {
    test(`should return 400 bad request when address parameter is ${description}`, async ({
      request,
    }) => {
      const response = await request.get('/api/portfolio/summary', params ? { params } : undefined);

      await expect(response).toHaveStatusCode(400);

      const body = await response.json();
      expect(body).toEqual({
        error: 'A valid wallet address query param is required',
      });
    });
  }

  test('should return 405 method not allowed for POST request', async ({ request }) => {
    const response = await request.post('/api/portfolio/summary');

    await expect(response).toHaveStatusCode(405);
  });
});
