import { test, expect } from '@playwright/test';
import { portfolioSummarySchema } from '../../utils/schema/api/portfolioSummarySchema.js';
import { validateSchema } from '../../utils/schema/validator.js';

test.describe('Portfolio Summary API', () => {
  const targetAddress = '0x9e3663d0a9F97Cde94E22407d603782B7E7101ED';

  test('should fetch portfolio summary for valid address', async ({ request }) => {
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

  test('should validate portfolio summary schema when 7-day change fields are null', () => {
    const nullFieldsPayload = {
      supersmoothPortfolioUsd: 0,
      supersmoothPortfolioChange7d: null,
      suppliedUsd: 0,
      suppliedChange7d: null,
      borrowedUsd: 0,
      borrowedChange7d: null,
      borrowedChange7dUsd: 0,
      chainBreakdown: [],
    };

    const validationResult = validateSchema(nullFieldsPayload, portfolioSummarySchema);

    expect(validationResult.errors).toEqual([]);
    expect(validationResult.valid).toBe(true);
  });
});

