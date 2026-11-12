import { test, expect } from '@playwright/test';
import { portfolioSummarySchema } from '../../utils/schema/api/portfolioSummarySchema';
import { validateSchema } from '../../utils/schema/validator';
import type { PortfolioSummaryResponse } from '../../utils/types/api/portfolioSummary';
import type { PortfolioSafesResponse } from '../../utils/types/api/portfolioSafes';
import { validAddress, zeroAddress, invalidAddressCases } from '../../utils/constants/addresses';
import '../../utils/assertions/matchers';
import { tc } from '../../utils/testCase';

function assertPortfolioConservation(body: PortfolioSummaryResponse, epsilon = 0.05): void {
  const calculatedNetUsd = body.suppliedUsd - body.borrowedUsd;
  expect(
    Math.abs(body.supersmoothPortfolioUsd - calculatedNetUsd),
    'Summary net worth must equal supplied - borrowed within epsilon',
  ).toBeLessThan(epsilon);

  if (body.chainBreakdown.length > 0) {
    const breakdownSum = body.chainBreakdown.reduce((acc, curr) => acc + curr.valueUsd, 0);
    expect(
      Math.abs(body.supersmoothPortfolioUsd - breakdownSum),
      'Chain breakdown value sum must equal total portfolio USD within epsilon',
    ).toBeLessThan(epsilon);

    if (body.supersmoothPortfolioUsd > 0) {
      const sharePercentSum = body.chainBreakdown.reduce((acc, curr) => acc + curr.sharePercent, 0);
      expect(
        Math.abs(100 - sharePercentSum),
        'Chain breakdown shares sum must equal 100% within tolerance',
      ).toBeLessThan(0.5);
    }
  }
}

test.describe('Portfolio Summary API', () => {
  test(
    'should fetch portfolio summary regardless of address casing',
    tc('API-PORT-007'),
    async ({ request }) => {
      const checksummedBody =
        await test.step('Fetch and validate checksummed address', async () => {
          const response = await request.get('/api/portfolio/summary', {
            params: {
              address: validAddress,
            },
          });
          await expect(response).toHaveStatusCode(200);

          const body: PortfolioSummaryResponse = await response.json();
          await validateSchema({ schema: portfolioSummarySchema, json: body });
          expect(
            Array.isArray(body.chainBreakdown),
            'Valid wallet address should return an array of chain breakdown items',
          ).toBe(true);
          assertPortfolioConservation(body);

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
    },
  );

  test(
    'should fetch portfolio summary for address with zero balance',
    tc('API-PORT-008'),
    async ({ request }) => {
      const targetAddress = zeroAddress;

      const response = await request.get('/api/portfolio/summary', {
        params: {
          address: targetAddress,
        },
      });

      await expect(response).toHaveStatusCode(200);

      const body: PortfolioSummaryResponse = await response.json();
      await validateSchema({ schema: portfolioSummarySchema, json: body });
      expect(body.supersmoothPortfolioUsd).toBe(0);
      expect(body.suppliedUsd).toBe(0);
      expect(body.borrowedUsd).toBe(0);
      expect(body.chainBreakdown).toEqual([]);
      expect(body.positionCount).toBe(0);
    },
  );

  test(
    'should reconcile active positions count against portfolio safes',
    tc('API-PORT-009'),
    async ({ request }) => {
      const [summaryRes, safesRes] = await Promise.all([
        request.get('/api/portfolio/summary', { params: { address: validAddress } }),
        request.get('/api/portfolio/safes', { params: { address: validAddress } }),
      ]);

      await expect(summaryRes).toHaveStatusCode(200);
      await expect(safesRes).toHaveStatusCode(200);

      const summary: PortfolioSummaryResponse = await summaryRes.json();
      const safes: PortfolioSafesResponse[] = await safesRes.json();

      const activePositions = safes.flatMap((safe) => safe.positions.filter((p) => p.isActive));
      expect(summary.positionCount, 'summary.positionCount must be defined').toBeDefined();
      expect(activePositions).toHaveLength(summary.positionCount!);
    },
  );

  for (const { description, params } of invalidAddressCases) {
    test(
      `should return 400 bad request when address parameter is ${description}`,
      tc('API-PORT-010'),
      async ({ request }) => {
        const response = await request.get(
          '/api/portfolio/summary',
          params ? { params } : undefined,
        );

        await expect(response).toHaveStatusCode(400);

        const body = await response.json();
        expect(body).toEqual({
          error: 'A valid wallet address query param is required',
        });
      },
    );
  }

  test(
    'should return 405 method not allowed for POST request',
    tc('API-PORT-011'),
    async ({ request }) => {
      const response = await request.post('/api/portfolio/summary');

      await expect(response).toHaveStatusCode(405);
    },
  );
});
