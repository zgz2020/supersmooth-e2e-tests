import { test, expect } from '@playwright/test';
import { portfolioSafesSchema } from '../../utils/schema/api/portfolioSafesSchema.js';
import { validateSchema } from '../../utils/schema/validator.js';
import type { PortfolioSafe } from '../../utils/types/api/portfolioSafes.js';
import { expectStatusCode } from '../../utils/assertions/solutions.js';

test.describe('Portfolio Safes API', () => {
  test('should fetch portfolio safes for valid checksummed address', async ({ request }) => {
    const targetAddress = '0x9e3663d0a9F97Cde94E22407d603782B7E7101ED';

    const response = await request.get('/api/portfolio/safes', {
      params: {
        address: targetAddress,
      },
    });

    await expectStatusCode({ actual: response.status(), expected: 200 });

    const body: PortfolioSafe[] = await response.json();
    await validateSchema({ schema: portfolioSafesSchema, json: body });
  });

  test('should fetch portfolio safes for valid lowercase address', async ({ request }) => {
    const targetAddress = '0x9e3663d0a9f97cde94e22407d603782b7e7101ed';

    const response = await request.get('/api/portfolio/safes', {
      params: {
        address: targetAddress,
      },
    });

    await expectStatusCode({ actual: response.status(), expected: 200 });

    const body: PortfolioSafe[] = await response.json();
    await validateSchema({ schema: portfolioSafesSchema, json: body });
  });

  test('should fetch portfolio safes for address with zero balance', async ({ request }) => {
    const targetAddress = '0x0000000000000000000000000000000000000000';

    const response = await request.get('/api/portfolio/safes', {
      params: {
        address: targetAddress,
      },
    });

    await expectStatusCode({ actual: response.status(), expected: 200 });

    const body: PortfolioSafe[] = await response.json();
    await validateSchema({ schema: portfolioSafesSchema, json: body });
    expect(body).toEqual([]);
  });

  test('should return 400 bad request when address parameter is missing', async ({ request }) => {
    const response = await request.get('/api/portfolio/safes');

    await expectStatusCode({ actual: response.status(), expected: 400 });

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

    await expectStatusCode({ actual: response.status(), expected: 400 });

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

    await expectStatusCode({ actual: response.status(), expected: 400 });

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

    await expectStatusCode({ actual: response.status(), expected: 400 });

    const body = await response.json();
    expect(body).toEqual({
      error: 'A valid wallet address query param is required',
    });
  });

  test('should return 405 method not allowed for POST request', async ({ request }) => {
    const response = await request.post('/api/portfolio/safes');

    await expectStatusCode({ actual: response.status(), expected: 405 });
  });
});
