import { test, expect } from '@playwright/test';
import { portfolioSummarySchema } from '../../utils/schema/api/portfolioSummarySchema.js';
import { validateSchema } from '../../utils/schema/validator.js';
import type { PortfolioSummary } from '../../utils/types/api/portfolioSummary.js';
import { expectStatusCode } from '../../utils/assertions/solutions.js';
import { validAddress, zeroAddress } from '../../utils/constants/addresses.js';

test.describe('Portfolio Summary API', () => {
  test('should fetch portfolio summary for valid checksummed address', async ({ request }) => {
    const targetAddress = validAddress;

    const response = await request.get('/api/portfolio/summary', {
      params: {
        address: targetAddress,
      },
    });

    await expectStatusCode({ actual: response.status(), expected: 200 });

    const body: PortfolioSummary = await response.json();
    await validateSchema({ schema: portfolioSummarySchema, json: body });
  });

  test('should fetch portfolio summary for valid lowercase address', async ({ request }) => {
    const targetAddress = validAddress.toLowerCase();

    const response = await request.get('/api/portfolio/summary', {
      params: {
        address: targetAddress,
      },
    });

    await expectStatusCode({ actual: response.status(), expected: 200 });

    const body: PortfolioSummary = await response.json();
    await validateSchema({ schema: portfolioSummarySchema, json: body });
  });

  test('should fetch portfolio summary for address with zero balance', async ({ request }) => {
    const targetAddress = zeroAddress;

    const response = await request.get('/api/portfolio/summary', {
      params: {
        address: targetAddress,
      },
    });

    await expectStatusCode({ actual: response.status(), expected: 200 });

    const body: PortfolioSummary = await response.json();
    await validateSchema({ schema: portfolioSummarySchema, json: body });
  });

  test('should return 400 bad request when address parameter is missing', async ({ request }) => {
    const response = await request.get('/api/portfolio/summary');

    await expectStatusCode({ actual: response.status(), expected: 400 });

    const body = await response.json();
    expect(body).toEqual({
      error: 'A valid wallet address query param is required',
    });
  });

  test('should return 400 bad request when address parameter is empty', async ({ request }) => {
    const response = await request.get('/api/portfolio/summary', {
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
    const response = await request.get('/api/portfolio/summary', {
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
    const response = await request.get('/api/portfolio/summary', {
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
    const response = await request.post('/api/portfolio/summary');

    await expectStatusCode({ actual: response.status(), expected: 405 });
  });
});
