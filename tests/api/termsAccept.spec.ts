import { test, expect } from '@playwright/test';
import { invalidAddressCases, validAddress } from '../../utils/constants/addresses';
import type { TermsAcceptPayload } from '../../utils/types/api/termsAccept';
import '../../utils/assertions/matchers';

const sampleSignature =
  '0x404ff65eeea36fa6d4a97a86b2dc588b830c287a383a6032baa2580dc478fdd124b14abf82d5aa92804c3ed4e7c0e15d0f15407bd1bec59a996afaa8fedd5aad1b';
const sampleNonce =
  '7139eb906c84bf55112642e56324c439.7c665d026e1ddf243367ba387ecd14c2187c851cbd39c04c21d5c58bc5854606';
const sampleIssuedAt = 1790940502;

interface InvalidPayloadCase {
  description: string;
  data: Partial<TermsAcceptPayload> | Record<string, unknown>;
}

const basePayload: TermsAcceptPayload = {
  wallet: validAddress,
  signature: sampleSignature,
  nonce: sampleNonce,
  issuedAt: sampleIssuedAt,
};

const invalidPayloadCases: InvalidPayloadCase[] = [
  {
    description: 'when signature or nonce is invalid or expired',
    data: basePayload,
  },
  {
    description: 'for empty request body',
    data: {},
  },
  {
    description: 'when signature field is missing',
    data: {
      wallet: validAddress,
      nonce: sampleNonce,
      issuedAt: sampleIssuedAt,
    },
  },
  {
    description: 'when nonce field is missing',
    data: {
      wallet: validAddress,
      signature: sampleSignature,
      issuedAt: sampleIssuedAt,
    },
  },
  {
    description: 'when issuedAt field is missing',
    data: {
      wallet: validAddress,
      signature: sampleSignature,
      nonce: sampleNonce,
    },
  },
  ...invalidAddressCases.map(({ description, params }) => ({
    description: `when wallet address is ${description}`,
    data: {
      wallet: params?.address,
      signature: sampleSignature,
      nonce: sampleNonce,
      issuedAt: sampleIssuedAt,
    },
  })),
];

test.describe('Terms Accept API', () => {
  for (const { description, data } of invalidPayloadCases) {
    test(`should return 401 unauthorized ${description}`, async ({ request }) => {
      const response = await request.post('/api/terms/accept', {
        data,
      });

      await expect(response).toHaveStatusCode(401);

      const headers = response.headers();
      expect(
        headers['content-type'],
        'Response content-type header should contain application/json',
      ).toContain('application/json');

      const body = await response.json();
      expect(body).toEqual({
        error: 'Unauthorized',
      });
    });
  }

  const unsupportedMethods = ['get', 'put', 'delete', 'patch'] as const;

  for (const method of unsupportedMethods) {
    test(`should return 405 method not allowed for ${method.toUpperCase()} request`, async ({
      request,
    }) => {
      const response = await request[method]('/api/terms/accept');

      await expect(response).toHaveStatusCode(405);
    });
  }
});
