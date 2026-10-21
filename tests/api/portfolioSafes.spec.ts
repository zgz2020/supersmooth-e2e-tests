import { test, expect } from '@playwright/test';
import { portfolioSafesSchema } from '../../utils/schema/api/portfolioSafesSchema';
import { validateSchema } from '../../utils/schema/validator';
import type { PortfolioSafesResponse } from '../../utils/types/api/portfolioSafes';
import { validAddress, zeroAddress, invalidAddressCases } from '../../utils/constants/addresses';
import '../../utils/assertions/matchers';

test.describe('Portfolio Safes API', () => {
  test('should fetch portfolio safes regardless of address casing', async ({ request }) => {
    const checksummedBody = await test.step('Fetch and validate checksummed address', async () => {
      const response = await request.get('/api/portfolio/safes', {
        params: {
          address: validAddress,
        },
      });
      await expect(response).toHaveStatusCode(200);

      const body: PortfolioSafesResponse[] = await response.json();
      await validateSchema({ schema: portfolioSafesSchema, json: body });
      expect(
        Array.isArray(body),
        'Valid wallet address should return an array of portfolio safes',
      ).toBe(true);

      return body;
    });

    await test.step('Fetch lowercase address and verify parity with checksummed response', async () => {
      const response = await request.get('/api/portfolio/safes', {
        params: {
          address: validAddress.toLowerCase(),
        },
      });
      await expect(response).toHaveStatusCode(200);

      const lowercaseBody: PortfolioSafesResponse[] = await response.json();
      expect(
        lowercaseBody,
        'Lowercase address response should match checksummed address response',
      ).toEqual(checksummedBody);
    });
  });

  test('should fetch portfolio safes for address with zero balance', async ({ request }) => {
    const targetAddress = zeroAddress;

    const response = await request.get('/api/portfolio/safes', {
      params: {
        address: targetAddress,
      },
    });

    await expect(response).toHaveStatusCode(200);

    const body: PortfolioSafesResponse[] = await response.json();
    await validateSchema({ schema: portfolioSafesSchema, json: body });
    expect(body, 'Zero balance address should return an empty array of safes').toEqual([]);
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
