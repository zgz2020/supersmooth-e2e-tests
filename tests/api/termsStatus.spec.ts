import { test, expect } from '@playwright/test';
import {
  invalidAddressCases,
  termsStatusAddresses,
  validAddress,
} from '../../utils/constants/addresses.js';
import type { TermsStatusResponse } from '../../utils/types/api/termsStatus.js';
import { termsStatusSchema } from '../../utils/schema/api/termsStatusSchema.js';
import { validateSchema } from '../../utils/schema/validator.js';
import '../../utils/assertions/matchers.js';

test.describe('Terms Status API', () => {
  test('should fetch terms status regardless of address casing', async ({ request }) => {
    const checksummedBody = await test.step('Fetch and validate checksummed address', async () => {
      const response = await request.get('/api/terms/status', {
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

      const body: TermsStatusResponse = await response.json();
      await validateSchema({ schema: termsStatusSchema, json: body });

      return body;
    });

    await test.step('Fetch lowercase address and verify parity with checksummed response', async () => {
      const response = await request.get('/api/terms/status', {
        params: {
          address: validAddress.toLowerCase(),
        },
      });
      await expect(response).toHaveStatusCode(200);

      const lowercaseBody: TermsStatusResponse = await response.json();
      await validateSchema({ schema: termsStatusSchema, json: lowercaseBody });
      expect(
        lowercaseBody,
        'Lowercase address response should match checksummed address response',
      ).toEqual(checksummedBody);
    });
  });

  for (const addressCase of termsStatusAddresses) {
    test(`should return signed status = ${addressCase.signedStatus} for address ${addressCase.params.address}`, async ({
      request,
    }) => {
      const response = await request.get('/api/terms/status', {
        params: {
          address: addressCase.params.address,
        },
      });

      await expect(response).toHaveStatusCode(200);

      const body: TermsStatusResponse = await response.json();
      await validateSchema({ schema: termsStatusSchema, json: body });
      expect(body.signed, `Signed status should be ${addressCase.signedStatus}`).toBe(
        addressCase.signedStatus,
      );
    });
  }

  test('should ignore extra unexpected query parameter and return 200', async ({ request }) => {
    const response = await request.get('/api/terms/status', {
      params: {
        address: validAddress,
        extraParam: 'foo',
      },
    });

    await expect(response).toHaveStatusCode(200);

    const body: TermsStatusResponse = await response.json();
    await validateSchema({ schema: termsStatusSchema, json: body });
  });

  for (const { description, params } of invalidAddressCases) {
    test(`should return 400 bad request when address parameter is ${description}`, async ({
      request,
    }) => {
      const response = await request.get('/api/terms/status', params ? { params } : undefined);

      await expect(response).toHaveStatusCode(400);

      const body = await response.json();
      expect(body).toEqual({
        error: 'address must be a valid EVM address',
      });
    });
  }

  const unsupportedMethods = ['post', 'put', 'delete', 'patch'] as const;

  for (const method of unsupportedMethods) {
    test(`should return 405 method not allowed for ${method.toUpperCase()} request`, async ({
      request,
    }) => {
      const response = await request[method]('/api/terms/status');

      await expect(response).toHaveStatusCode(405);
    });
  }
});
