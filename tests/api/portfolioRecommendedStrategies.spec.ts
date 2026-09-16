import { test, expect } from '@playwright/test';
import { portfolioRecommendedStrategiesSchema } from '../../utils/schema/api/portfolioRecommendedStrategiesSchema.js';
import { validateSchema } from '../../utils/schema/validator.js';
import type { PortfolioRecommendedStrategies } from '../../utils/types/api/portfolioRecommendedStrategies.js';
import '../../utils/assertions/matchers.js';

test.describe('Portfolio Recommended Strategies API', () => {
  test('should fetch recommended strategies', async ({ request }) => {
    const response = await request.get('/api/portfolio/recommended-strategies');

    await expect(response).toHaveStatusCode(200);

    const body: PortfolioRecommendedStrategies = await response.json();
    await validateSchema({ schema: portfolioRecommendedStrategiesSchema, json: body });
    expect(body.cards.length).toBeGreaterThan(0);
    for (const card of body.cards) {
      expect(card.tokens.length).toBeGreaterThan(0);
      expect(card.url).toMatch(/^\/products\//);
    }
  });

  test('should return 405 method not allowed for POST request', async ({ request }) => {
    const response = await request.post('/api/portfolio/recommended-strategies');

    await expect(response).toHaveStatusCode(405);
  });
});
