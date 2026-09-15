import { test, expect } from '@playwright/test';
import { portfolioSummarySchema } from '../../utils/schema/api/portfolioSummarySchema.js';
import { validateSchema } from '../../utils/schema/validator.js';

test.describe('Portfolio Summary API', () => {
  test('should fetch portfolio summary for valid address', async ({ request }) => {
    const targetAddress = '0x9e3663d0a9F97Cde94E22407d603782B7E7101ED';

    const response = await request.get('/api/portfolio/summary', {
      params: {
        address: targetAddress,
      },
    });

    expect(response.status()).toBe(200);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    const validationResult = validateSchema(body, portfolioSummarySchema);

    expect(validationResult.errors).toEqual([]);
    expect(validationResult.valid).toBe(true);
  });

  test('should fetch portfolio summary for address with zero balance', async ({ request }) => {
    const targetAddress = '0x0000000000000000000000000000000000000000';

    const response = await request.get('/api/portfolio/summary', {
      params: {
        address: targetAddress,
      },
    });

    expect(response.status()).toBe(200);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    const validationResult = validateSchema(body, portfolioSummarySchema);

    expect(validationResult.errors).toEqual([]);
    expect(validationResult.valid).toBe(true);
  });
});
