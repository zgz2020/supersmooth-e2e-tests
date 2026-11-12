import { test, expect } from '@playwright/test';
import { complianceGeoSchema } from '../../utils/schema/api/complianceGeoSchema';
import { validateSchema } from '../../utils/schema/validator';
import type { ComplianceGeoResponse } from '../../utils/types/api/complianceGeo';
import '../../utils/assertions/matchers';
import { tc } from '../../utils/testCase';

test.use({
  baseURL: process.env.LOCAL_BASE_URL || 'http://localhost:3000',
});

interface FakeGeoScenario {
  description: string;
  country: string;
  expectedCountry: string;
  expectedBlockedSurfaces: string[];
}

const fakeGeoScenarios: FakeGeoScenario[] = [
  {
    description: 'sanctioned country (Russia)',
    country: 'RU',
    expectedCountry: 'RU',
    expectedBlockedSurfaces: ['ALL'],
  },
  {
    description: 'sanctioned country (Cuba)',
    country: 'CU',
    expectedCountry: 'CU',
    expectedBlockedSurfaces: ['ALL'],
  },
  {
    description: 'sanctioned country (Iran)',
    country: 'IR',
    expectedCountry: 'IR',
    expectedBlockedSurfaces: ['ALL'],
  },
  {
    description: 'restricted country (United States)',
    country: 'US',
    expectedCountry: 'US',
    expectedBlockedSurfaces: ['PERP_TRADING', 'SWAP'],
  },
  {
    description: 'allowed country (Spain)',
    country: 'ES',
    expectedCountry: 'ES',
    expectedBlockedSurfaces: [],
  },
  {
    description: 'allowed country (United Kingdom)',
    country: 'GB',
    expectedCountry: 'GB',
    expectedBlockedSurfaces: [],
  },
];

test.describe('Compliance Geo API - Local Fake Geolocation via cf-ipcountry', () => {
  for (const {
    description,
    country,
    expectedCountry,
    expectedBlockedSurfaces,
  } of fakeGeoScenarios) {
    test(
      `should resolve ${description} with fake cf-ipcountry header`,
      tc('API-COMP-004'),
      async ({ request }) => {
        const response = await request.get('/api/compliance/geo', {
          headers: {
            'cf-ipcountry': country,
          },
        });

        await expect(response).toHaveStatusCode(200);

        const responseHeaders = response.headers();
        expect(
          responseHeaders['content-type'],
          'Response content-type header should contain application/json',
        ).toContain('application/json');
        expect(
          responseHeaders['cache-control'],
          'Response cache-control header should be no-store',
        ).toBe('no-store');

        const body: ComplianceGeoResponse = await response.json();
        console.log(`Compliance Geo response for ${country}:`, body);

        await validateSchema({ schema: complianceGeoSchema, json: body });

        expect(body.country, `Response country should be ${expectedCountry}`).toBe(expectedCountry);
        expect(
          body.blockedSurfaces,
          `Response blockedSurfaces should match expectation for ${expectedCountry} - ${expectedBlockedSurfaces.length > 0 ? expectedBlockedSurfaces : 'no blocked surfaces'}`,
        ).toEqual(expectedBlockedSurfaces);
      },
    );
  }

  test(
    'should handle lowercase cf-ipcountry header and normalize to uppercase',
    tc('API-COMP-005'),
    async ({ request }) => {
      const response = await request.get('/api/compliance/geo', {
        headers: {
          'cf-ipcountry': 'ru',
        },
      });

      await expect(response).toHaveStatusCode(200);

      const body: ComplianceGeoResponse = await response.json();
      await validateSchema({ schema: complianceGeoSchema, json: body });
      expect(body.country, 'Response country should be normalized to uppercase RU').toBe('RU');
    },
  );

  test(
    'should fallback to default geolocation when cf-ipcountry header is omitted',
    tc('API-COMP-006'),
    async ({ request }) => {
      const response = await request.get('/api/compliance/geo');

      await expect(response).toHaveStatusCode(200);

      const body: ComplianceGeoResponse = await response.json();
      await validateSchema({ schema: complianceGeoSchema, json: body });
      expect(body.country, 'Response country should fallback to default ES').toBe('ES');
    },
  );
});
