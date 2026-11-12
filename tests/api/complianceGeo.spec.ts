import { test, expect } from '@playwright/test';
import { complianceGeoSchema } from '../../utils/schema/api/complianceGeoSchema';
import { validateSchema } from '../../utils/schema/validator';
import type { ComplianceGeoResponse } from '../../utils/types/api/complianceGeo';
import '../../utils/assertions/matchers';
import { tc } from '../../utils/testCase';

test.describe('Compliance Geo API', () => {
  test(
    'should fetch compliance geo information successfully',
    tc('API-COMP-001'),
    async ({ request }) => {
      const response = await request.get('/api/compliance/geo');

      await expect(response).toHaveStatusCode(200);

      const headers = response.headers();
      expect(
        headers['content-type'],
        'Response content-type header should contain application/json',
      ).toContain('application/json');
      expect(headers['cache-control'], 'Response cache-control header should be no-store').toBe(
        'no-store',
      );

      const body: ComplianceGeoResponse = await response.json();
      await validateSchema({ schema: complianceGeoSchema, json: body });
    },
  );

  test(
    'should ignore extra unexpected query parameter and return 200',
    tc('API-COMP-002'),
    async ({ request }) => {
      const response = await request.get('/api/compliance/geo', {
        params: {
          extraParam: 'foo',
        },
      });

      await expect(response).toHaveStatusCode(200);

      const body: ComplianceGeoResponse = await response.json();
      await validateSchema({ schema: complianceGeoSchema, json: body });
    },
  );

  const unsupportedMethods = ['post', 'put', 'delete', 'patch'] as const;

  for (const method of unsupportedMethods) {
    test(
      `should return 405 method not allowed for ${method.toUpperCase()} request`,
      tc('API-COMP-003'),
      async ({ request }) => {
        const response = await request[method]('/api/compliance/geo');

        await expect(response).toHaveStatusCode(405);
      },
    );
  }
});
