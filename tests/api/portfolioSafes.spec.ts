import { test, expect } from '@playwright/test';
import { portfolioSafesSchema } from '../../utils/schema/api/portfolioSafesSchema.js';
import { validateSchema } from '../../utils/schema/validator.js';
import type { PortfolioSafe } from '../../utils/types/api/portfolioSafes.js';
import { validAddress, zeroAddress, invalidAddressCases } from '../../utils/constants/addresses.js';
import '../../utils/assertions/matchers.js';

test.describe('Portfolio Safes API', () => {
  test('should fetch portfolio safes regardless of address casing', async ({ request }) => {
    const checksummedResponse = await request.get('/api/portfolio/safes', {
      params: {
        address: validAddress,
      },
    });
    await expect(checksummedResponse).toHaveStatusCode(200);

    const checksummedBody: PortfolioSafe[] = await checksummedResponse.json();
    await validateSchema({ schema: portfolioSafesSchema, json: checksummedBody });
    expect(checksummedBody.length).toBeGreaterThan(0);

    const lowercaseResponse = await request.get('/api/portfolio/safes', {
      params: {
        address: validAddress.toLowerCase(),
      },
    });
    await expect(lowercaseResponse).toHaveStatusCode(200);

    const lowercaseBody: PortfolioSafe[] = await lowercaseResponse.json();
    expect(lowercaseBody).toEqual(checksummedBody);
  });

  test('should fetch portfolio safes for address with zero balance', async ({ request }) => {
    const targetAddress = zeroAddress;

    const response = await request.get('/api/portfolio/safes', {
      params: {
        address: targetAddress,
      },
    });

    await expect(response).toHaveStatusCode(200);

    const body: PortfolioSafe[] = await response.json();
    await validateSchema({ schema: portfolioSafesSchema, json: body });
    expect(body).toEqual([]);
  });

  for (const { description, params } of invalidAddressCases) {
    test(`should return 400 bad request when address parameter is ${description}`, async ({
      request,
    }) => {
      const response = await request.get('/api/portfolio/safes', params ? { params } : undefined);

      await expect(response).toHaveStatusCode(400);

      const body = await response.json();
      expect(body).toEqual({
        error: 'A valid wallet address query param is required',
      });
    });
  }

  test('should return 405 method not allowed for POST request', async ({ request }) => {
    const response = await request.post('/api/portfolio/safes');

    await expect(response).toHaveStatusCode(405);
  });
});
