import { test, expect } from '@playwright/test';
import { invalidAddressCases, validAddress, zeroAddress } from '../../utils/constants/addresses.js';
import type { MigrateAdoptableSafesResponse } from '../../utils/types/api/migrateAdoptableSafes.js';
import { migrateAdoptableSafesSchema } from '../../utils/schema/api/migrateAdoptableSafesSchema.js';
import { validateSchema } from '../../utils/schema/validator.js';
import '../../utils/assertions/matchers.js';

test.describe('Migrate Adoptable Safes API', () => {
  test('should fetch adoptable safes regardless of address casing', async ({ request }) => {
    const checksummedBody = await test.step('Fetch and validate checksummed address', async () => {
      const response = await request.get('/api/migrate/adoptable-safes', {
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

      const body: MigrateAdoptableSafesResponse = await response.json();
      await validateSchema({ schema: migrateAdoptableSafesSchema, json: body });
      expect(
        body.safes.length,
        'Valid wallet address should return at least one adoptable safe item',
      ).toBeGreaterThan(0);

      return body;
    });

    await test.step('Fetch lowercase address and verify parity with checksummed response', async () => {
      const response = await request.get('/api/migrate/adoptable-safes', {
        params: {
          address: validAddress.toLowerCase(),
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
        expect(lowercaseItem?.position.debt.address).toEqual(checksummedItem.position.debt.address);
        expect(lowercaseItem?.position.debt.symbol).toEqual(checksummedItem.position.debt.symbol);
      }
    });
  });

  test('should fetch adoptable safes for address with zero balance', async ({ request }) => {
    const response = await request.get('/api/migrate/adoptable-safes', {
      params: {
        address: zeroAddress,
      },
    });

    await expect(response).toHaveStatusCode(200);

    const body: MigrateAdoptableSafesResponse = await response.json();
    await validateSchema({ schema: migrateAdoptableSafesSchema, json: body });
    expect(body.safes, 'Zero balance address should return an empty array of safes').toEqual([]);
  });

  test('should ignore extra unexpected query parameter and return 200', async ({ request }) => {
    const response = await request.get('/api/migrate/adoptable-safes', {
      params: {
        address: validAddress,
        extraParam: 'foo',
      },
    });

    await expect(response).toHaveStatusCode(200);

    const body: MigrateAdoptableSafesResponse = await response.json();
    await validateSchema({ schema: migrateAdoptableSafesSchema, json: body });
    expect(
      body.safes.length,
      'Valid wallet address should return adoptable safes even with extra params',
    ).toBeGreaterThan(0);
  });

  for (const { description, params } of invalidAddressCases) {
    test(`should return 400 bad request when address parameter is ${description}`, async ({
      request,
    }) => {
      const response = await request.get(
        '/api/migrate/adoptable-safes',
        params ? { params } : undefined,
      );

      await expect(response).toHaveStatusCode(400);

      const body = await response.json();
      expect(body).toEqual({
        error: 'A valid wallet address query param is required',
      });
    });
  }

  const unsupportedMethods = ['post', 'put', 'delete', 'patch'] as const;

  for (const method of unsupportedMethods) {
    test(`should return 405 method not allowed for ${method.toUpperCase()} request`, async ({
      request,
    }) => {
      const response = await request[method]('/api/migrate/adoptable-safes');

      await expect(response).toHaveStatusCode(405);
    });
  }
});
