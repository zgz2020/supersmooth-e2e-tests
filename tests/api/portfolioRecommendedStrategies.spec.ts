import { test, expect } from '@playwright/test';
import { portfolioRecommendedStrategiesSchema } from '../../utils/schema/api/portfolioRecommendedStrategiesSchema';
import { validateSchema } from '../../utils/schema/validator';
import type { PortfolioRecommendedStrategies } from '../../utils/types/api/portfolioRecommendedStrategies';
import '../../utils/assertions/matchers';
import { tc } from '../../utils/testCase';

test.describe('Portfolio Recommended Strategies API', () => {
  test('should fetch recommended strategies', tc('API-PORT-001'), async ({ request }) => {
    const response = await request.get('/api/portfolio/recommended-strategies');

    await expect(response).toHaveStatusCode(200);

    const body: PortfolioRecommendedStrategies = await response.json();
    await validateSchema({ schema: portfolioRecommendedStrategiesSchema, json: body });
    expect(
      body.cards.length,
      'Response should contain at least one recommended strategy card',
    ).toBeGreaterThan(0);
    for (const card of body.cards) {
      expect(
        card.tokens.length,
        `Card ${card.id} should contain at least one token`,
      ).toBeGreaterThan(0);
      expect(card.url, `Card ${card.id} URL should start with /products/`).toMatch(/^\/products\//);
    }
  });

  test(
    'should return 405 method not allowed for POST request',
    tc('API-PORT-002'),
    async ({ request }) => {
      const response = await request.post('/api/portfolio/recommended-strategies');

      await expect(response).toHaveStatusCode(405);
    },
  );
});
