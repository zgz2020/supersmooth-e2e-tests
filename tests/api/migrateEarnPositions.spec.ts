import { test, expect } from '@playwright/test';
import { invalidAddressCases, validAddress, zeroAddress } from '../../utils/constants/addresses';
import type { MigrateEarnPositionsResponse } from '../../utils/types/api/migrateEarnPositions';
import { migrateEarnPositionsSchema } from '../../utils/schema/api/migrateEarnPositionsSchema';
import { validateSchema } from '../../utils/schema/validator';
import '../../utils/assertions/matchers';
import { tc } from '../../utils/testCase';

test.describe('Migrate Earn Positions API', () => {
  test(
    'should fetch migrate earn positions regardless of address casing',
    tc('API-MIGR-006'),
    async ({ request }) => {
      const checksummedBody =
        await test.step('Fetch and validate checksummed address', async () => {
          const response = await request.get('/api/migrate/earn-positions', {
            params: {
              address: validAddress,
            },
          });

          await expect(response).toHaveStatusCode(200);

          const headers = response.headers();
          expect(
            headers['content-type'],
            'Response content-type header should contain application/json',
          ).toContain('application/json');

          const body: MigrateEarnPositionsResponse = await response.json();
          await validateSchema({ schema: migrateEarnPositionsSchema, json: body });
          expect(
            body.migrations.length,
            'Valid wallet address should return at least one earn position migration item',
          ).toBeGreaterThan(0);

          return body;
        });

      await test.step('Fetch lowercase address and verify parity with checksummed response', async () => {
        const response = await request.get('/api/migrate/earn-positions', {
          params: {
            address: validAddress.toLowerCase(),
          },
        });

        await expect(response).toHaveStatusCode(200);

        const lowercaseBody: MigrateEarnPositionsResponse = await response.json();
        await validateSchema({ schema: migrateEarnPositionsSchema, json: lowercaseBody });

        expect(
          lowercaseBody.migrations,
          'Lowercase address response should return the same number of migrations',
        ).toHaveLength(checksummedBody.migrations.length);

        for (const checksummedItem of checksummedBody.migrations) {
          const lowercaseItem = lowercaseBody.migrations.find(
            (item) => item.id === checksummedItem.id,
          );
          expect(
            lowercaseItem,
            `Migration with id ${checksummedItem.id} should exist in lowercase response`,
          ).toBeDefined();
          expect(lowercaseItem?.id).toEqual(checksummedItem.id);
          expect(lowercaseItem?.chainId).toEqual(checksummedItem.chainId);
          expect(lowercaseItem?.protocol).toEqual(checksummedItem.protocol);
          expect(lowercaseItem?.marketIdentifier).toEqual(checksummedItem.marketIdentifier);
          expect(lowercaseItem?.assetAddress).toEqual(checksummedItem.assetAddress);
          expect(lowercaseItem?.receiptToken).toEqual(checksummedItem.receiptToken);
        }
      });
    },
  );

  test(
    'should fetch migrate earn positions for address with zero balance',
    tc('API-MIGR-007'),
    async ({ request }) => {
      const response = await request.get('/api/migrate/earn-positions', {
        params: {
          address: zeroAddress,
        },
      });

      await expect(response).toHaveStatusCode(200);

      const body: MigrateEarnPositionsResponse = await response.json();
      await validateSchema({ schema: migrateEarnPositionsSchema, json: body });
    },
  );

  test(
    'should ignore extra unexpected query parameter and return 200',
    tc('API-MIGR-008'),
    async ({ request }) => {
      const response = await request.get('/api/migrate/earn-positions', {
        params: {
          address: validAddress,
          extraParam: 'foo',
        },
      });

      await expect(response).toHaveStatusCode(200);

      const body: MigrateEarnPositionsResponse = await response.json();
      await validateSchema({ schema: migrateEarnPositionsSchema, json: body });
    },
  );

  for (const { description, params } of invalidAddressCases) {
    test(
      `should return 400 bad request when address parameter is ${description}`,
      tc('API-MIGR-009'),
      async ({ request }) => {
        const response = await request.get(
          '/api/migrate/earn-positions',
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
      tc('API-MIGR-010'),
      async ({ request }) => {
        const response = await request[method]('/api/migrate/earn-positions');

        await expect(response).toHaveStatusCode(405);
      },
    );
  }
});
