import { test, expect } from '@playwright/test';
import { invalidAddressCases, validAddress } from '../../utils/constants/addresses';
import type { TermsNonceResponse } from '../../utils/types/api/termsNonce';
import { termsNonceSchema } from '../../utils/schema/api/termsNonceSchema';
import { validateSchema } from '../../utils/schema/validator';
import '../../utils/assertions/matchers';
import { tc } from '../../utils/testCase';

test.describe('Terms Nonce API', () => {
  test(
    'should fetch terms nonce regardless of address casing',
    tc('API-TERMS-003'),
    async ({ request }) => {
      await test.step('Fetch and validate checksummed address', async () => {
        const response = await request.get('/api/terms/nonce', {
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

        const body: TermsNonceResponse = await response.json();
        await validateSchema({ schema: termsNonceSchema, json: body });
      });

      await test.step('Fetch and validate lowercase address', async () => {
        const response = await request.get('/api/terms/nonce', {
          params: {
            address: validAddress.toLowerCase(),
          },
        });

        await expect(response).toHaveStatusCode(200);

        const body: TermsNonceResponse = await response.json();
        await validateSchema({ schema: termsNonceSchema, json: body });
      });
    },
  );

  test(
    'should ignore extra unexpected query parameter and return 200',
    tc('API-TERMS-004'),
    async ({ request }) => {
      const response = await request.get('/api/terms/nonce', {
        params: {
          address: validAddress,
          extraParam: 'foo',
        },
      });

      await expect(response).toHaveStatusCode(200);

      const body: TermsNonceResponse = await response.json();
      await validateSchema({ schema: termsNonceSchema, json: body });
    },
  );

  for (const { description, params } of invalidAddressCases) {
    test(
      `should return 400 bad request when address parameter is ${description}`,
      tc('API-TERMS-005'),
      async ({ request }) => {
        const response = await request.get('/api/terms/nonce', params ? { params } : undefined);

        await expect(response).toHaveStatusCode(400);

        const body = await response.json();
        expect(body).toEqual({
          error: 'address must be a valid EVM address',
        });
      },
    );
  }

  const unsupportedMethods = ['post', 'put', 'delete', 'patch'] as const;

  for (const method of unsupportedMethods) {
    test(
      `should return 405 method not allowed for ${method.toUpperCase()} request`,
      tc('API-TERMS-006'),
      async ({ request }) => {
        const response = await request[method]('/api/terms/nonce');

        await expect(response).toHaveStatusCode(405);
      },
    );
  }
});
