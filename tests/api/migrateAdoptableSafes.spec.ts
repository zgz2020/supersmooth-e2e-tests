import { test, expect } from '@playwright/test';
import {
  adoptableSafeFixture,
  invalidAddressCases,
  zeroAddress,
} from '../../utils/constants/addresses';
import type { MigrateAdoptableSafesResponse } from '../../utils/types/api/migrateAdoptableSafes';
import { migrateAdoptableSafesSchema } from '../../utils/schema/api/migrateAdoptableSafesSchema';
import { validateSchema } from '../../utils/schema/validator';
import '../../utils/assertions/matchers';
import { tc } from '../../utils/testCase';

/** Fails with an actionable message when the live fixture Safe is missing from the response */
const expectFixtureSafeListed = (body: MigrateAdoptableSafesResponse) => {
  const { safe, chainId } = adoptableSafeFixture;
  expect(
    body.safes.some(
      (item) => item.safe.toLowerCase() === safe.toLowerCase() && item.chainId === chainId,
    ),
    `Fixture Safe ${safe} (chain ${chainId}) is not adoptable. This is usually test data, not an app bug: ` +
      'check its Aave v3 collateral on Base is >= $1 and it has no Supersmooth module (see adoptableSafeFixture).',
  ).toBe(true);
};

test.describe('Migrate Adoptable Safes API', () => {
  test(
    'should fetch adoptable safes regardless of address casing',
    tc('API-MIGR-001'),
    async ({ request }) => {
      const checksummedBody =
        await test.step('Fetch and validate checksummed address', async () => {
          const response = await request.get('/api/migrate/adoptable-safes', {
            params: {
              address: adoptableSafeFixture.owner,
            },
          });

          await expect(response).toHaveStatusCode(200);

          const headers = response.headers();
          expect(
            headers['content-type'],
            'Response content-type header should contain application/json',
          ).toContain('application/json');

          const body: MigrateAdoptableSafesResponse = await response.json();
          await validateSchema({ schema: migrateAdoptableSafesSchema, json: body });
          expectFixtureSafeListed(body);

          return body;
        });

      await test.step('Fetch lowercase address and verify parity with checksummed response', async () => {
        const response = await request.get('/api/migrate/adoptable-safes', {
          params: {
            address: adoptableSafeFixture.owner.toLowerCase(),
          },
        });

        await expect(response).toHaveStatusCode(200);

        const lowercaseBody: MigrateAdoptableSafesResponse = await response.json();
        await validateSchema({ schema: migrateAdoptableSafesSchema, json: lowercaseBody });

        expect(
          lowercaseBody.safes,
          'Lowercase address response should return the same number of safes',
        ).toHaveLength(checksummedBody.safes.length);

        for (const checksummedItem of checksummedBody.safes) {
          const lowercaseItem = lowercaseBody.safes.find(
            (item) => item.safe.toLowerCase() === checksummedItem.safe.toLowerCase(),
          );
          expect(
            lowercaseItem,
            `Safe with address ${checksummedItem.safe} should exist in lowercase response`,
          ).toBeDefined();
          expect(lowercaseItem?.safe).toEqual(checksummedItem.safe);
          expect(lowercaseItem?.chainId).toEqual(checksummedItem.chainId);
          expect(lowercaseItem?.usesDefiSaver).toEqual(checksummedItem.usesDefiSaver);
          expect(lowercaseItem?.holdsOtherPositions).toEqual(checksummedItem.holdsOtherPositions);
          expect(lowercaseItem?.otherAutomations).toEqual(checksummedItem.otherAutomations);

          expect(lowercaseItem?.position.id).toEqual(checksummedItem.position.id);
          expect(lowercaseItem?.position.chainId).toEqual(checksummedItem.position.chainId);
          expect(lowercaseItem?.position.protocol).toEqual(checksummedItem.position.protocol);
          expect(lowercaseItem?.position.marketIdentifier).toEqual(
            checksummedItem.position.marketIdentifier,
          );
          expect(lowercaseItem?.position.collateral.address).toEqual(
            checksummedItem.position.collateral.address,
          );
          expect(lowercaseItem?.position.collateral.symbol).toEqual(
            checksummedItem.position.collateral.symbol,
          );
          expect(lowercaseItem?.position.debt.address).toEqual(
            checksummedItem.position.debt.address,
          );
          expect(lowercaseItem?.position.debt.symbol).toEqual(checksummedItem.position.debt.symbol);
        }
      });
    },
  );

  test(
    'should fetch adoptable safes for address with zero balance',
    tc('API-MIGR-002'),
    async ({ request }) => {
      const response = await request.get('/api/migrate/adoptable-safes', {
        params: {
          address: zeroAddress,
        },
      });

      await expect(response).toHaveStatusCode(200);

      const body: MigrateAdoptableSafesResponse = await response.json();
      await validateSchema({ schema: migrateAdoptableSafesSchema, json: body });
      expect(body.safes, 'Zero balance address should return an empty array of safes').toEqual([]);
    },
  );

  test(
    'should ignore extra unexpected query parameter and return 200',
    tc('API-MIGR-003'),
    async ({ request }) => {
      const response = await request.get('/api/migrate/adoptable-safes', {
        params: {
          address: adoptableSafeFixture.owner,
          extraParam: 'foo',
        },
      });

      await expect(response).toHaveStatusCode(200);

      const body: MigrateAdoptableSafesResponse = await response.json();
      await validateSchema({ schema: migrateAdoptableSafesSchema, json: body });
      expectFixtureSafeListed(body);
    },
  );

  for (const { description, params } of invalidAddressCases) {
    test(
      `should return 400 bad request when address parameter is ${description}`,
      tc('API-MIGR-004'),
      async ({ request }) => {
        const response = await request.get(
          '/api/migrate/adoptable-safes',
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

  const unsupportedMethods = ['post', 'put', 'delete', 'patch'] as const;

  for (const method of unsupportedMethods) {
    test(
      `should return 405 method not allowed for ${method.toUpperCase()} request`,
      tc('API-MIGR-005'),
      async ({ request }) => {
        const response = await request[method]('/api/migrate/adoptable-safes');

        await expect(response).toHaveStatusCode(405);
      },
    );
  }
});
