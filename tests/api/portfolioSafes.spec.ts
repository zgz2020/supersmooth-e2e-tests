import { test, expect } from '@playwright/test';
import { portfolioSafesSchema } from '../../utils/schema/api/portfolioSafesSchema.js';
import { validateSchema } from '../../utils/schema/validator.js';
import type { PortfolioSafe } from '../../utils/types/api/portfolioSafes.js';
import { validAddress, zeroAddress } from '../../utils/constants/addresses.js';
import '../../utils/assertions/solutions.js';

test.describe('Portfolio Safes API', () => {
  test('should fetch portfolio safes for valid checksummed address', async ({ request }) => {
    const targetAddress = validAddress;

    const response = await request.get('/api/portfolio/safes', {
      params: {
        address: targetAddress,
      },
    });

    await expect(response).toHaveStatusCode(200);

    const body: PortfolioSafe[] = await response.json();
    await validateSchema({ schema: portfolioSafesSchema, json: body });
  });

  test('should fetch portfolio safes for valid lowercase address', async ({ request }) => {
    const targetAddress = validAddress.toLowerCase();

    const response = await request.get('/api/portfolio/safes', {
      params: {
        address: targetAddress,
      },
    });

    await expect(response).toHaveStatusCode(200);

    const body: PortfolioSafe[] = await response.json();
    await validateSchema({ schema: portfolioSafesSchema, json: body });
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

  test('should return 400 bad request when address parameter is missing', async ({ request }) => {
    const response = await request.get('/api/portfolio/safes');

    await expect(response).toHaveStatusCode(400);

    const body = await response.json();
    expect(body).toEqual({
      error: 'A valid wallet address query param is required',
    });
  });

  test('should return 400 bad request when address parameter is empty', async ({ request }) => {
    const response = await request.get('/api/portfolio/safes', {
      params: {
        address: '',
      },
    });

    await expect(response).toHaveStatusCode(400);

    const body = await response.json();
    expect(body).toEqual({
      error: 'A valid wallet address query param is required',
    });
  });

  test('should return 400 bad request when address parameter is invalid string', async ({
    request,
  }) => {
    const response = await request.get('/api/portfolio/safes', {
      params: {
        address: 'invalid-address',
      },
    });

    await expect(response).toHaveStatusCode(400);

    const body = await response.json();
    expect(body).toEqual({
      error: 'A valid wallet address query param is required',
    });
  });

  test('should return 400 bad request when address parameter is short hex', async ({ request }) => {
    const response = await request.get('/api/portfolio/safes', {
      params: {
        address: '0x123',
      },
    });

    await expect(response).toHaveStatusCode(400);
    await expect(response).toHaveStatusCode(400);

    const body = await response.json();
    expect(body).toEqual({
      error: 'A valid wallet address query param is required',
    });
  });

  test('should return 405 method not allowed for POST request', async ({ request }) => {
    const response = await request.post('/api/portfolio/safes');

    await expect(response).toHaveStatusCode(405);
  });
});
