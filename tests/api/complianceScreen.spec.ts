import { test, expect } from '@playwright/test';
import { complianceScreenSchema } from '../../utils/schema/api/complianceScreenSchema';
import { validateSchema } from '../../utils/schema/validator';
import type { ComplianceScreenResponse } from '../../utils/types/api/complianceScreen';
import { validAddress, sanctionedAddress } from '../../utils/constants/addresses';
import '../../utils/assertions/matchers';

const getOriginHeader = (baseURL?: string) => ({
  origin: baseURL ? new URL(baseURL).origin : 'https://aphelion-app.onrender.com',
});

interface InvalidPayloadCase {
  description: string;
  payload: Record<string, unknown>;
  expectedError: string;
}

test.describe('Compliance Screen API', () => {
  test('should screen wallet regardless of address casing', async ({ request, baseURL }) => {
    const checksummedBody = await test.step('Fetch and validate checksummed address', async () => {
      const response = await request.post('/api/compliance/screen', {
        headers: getOriginHeader(baseURL),
        data: { wallet: validAddress, context: 'connect' },
      });

      await expect(response).toHaveStatusCode(200);

      const headers = response.headers();
      expect(
        headers['content-type'],
        'Response content-type header should contain application/json',
      ).toContain('application/json');
      expect(headers['cache-control'], 'Response cache-control header should be no-store').toBe(
        'no-store',
      );

      const body: ComplianceScreenResponse = await response.json();
      await validateSchema({ schema: complianceScreenSchema, json: body });
      expect(body.sanctioned, 'Valid checksummed wallet should return sanctioned: false').toBe(
        false,
      );

      return body;
    });

    await test.step('Fetch lowercase address and verify parity with checksummed response', async () => {
      const response = await request.post('/api/compliance/screen', {
        headers: getOriginHeader(baseURL),
        data: { wallet: validAddress.toLowerCase(), context: 'connect' },
      });

      await expect(response).toHaveStatusCode(200);

      const lowercaseBody: ComplianceScreenResponse = await response.json();
      await validateSchema({ schema: complianceScreenSchema, json: lowercaseBody });
      expect(
        lowercaseBody,
        'Lowercase address response should match checksummed address response',
      ).toEqual(checksummedBody);
    });
  });

  test('should screen wallet successfully for perps-submit context', async ({
    request,
    baseURL,
  }) => {
    const payload = { wallet: validAddress, context: 'perps-submit' };

    const response = await request.post('/api/compliance/screen', {
      headers: getOriginHeader(baseURL),
      data: payload,
    });

    await expect(response).toHaveStatusCode(200);

    const body: ComplianceScreenResponse = await response.json();
    await validateSchema({ schema: complianceScreenSchema, json: body });
  });

  test('should flag sanctioned wallet address', async ({ request, baseURL }) => {
    const payload = { wallet: sanctionedAddress, context: 'connect' };

    const response = await request.post('/api/compliance/screen', {
      headers: getOriginHeader(baseURL),
      data: payload,
    });

    await expect(response).toHaveStatusCode(200);

    const body: ComplianceScreenResponse = await response.json();
    await validateSchema({ schema: complianceScreenSchema, json: body });
    expect(body.sanctioned, 'Sanctioned wallet should return sanctioned: true').toBe(true);
  });

  test('should return 401 unauthorized when origin header is missing', async ({ request }) => {
    const payload = { wallet: validAddress, context: 'connect' };

    const response = await request.post('/api/compliance/screen', {
      data: payload,
    });

    await expect(response).toHaveStatusCode(401);

    const body = await response.json();
    expect(body).toEqual({ error: 'Unauthorized' });
  });

  test('should return 401 unauthorized when origin header is untrusted', async ({ request }) => {
    const payload = { wallet: validAddress, context: 'connect' };

    const response = await request.post('/api/compliance/screen', {
      headers: { origin: 'https://unauthorized-domain.com' },
      data: payload,
    });

    await expect(response).toHaveStatusCode(401);

    const body = await response.json();
    expect(body).toEqual({ error: 'Unauthorized' });
  });

  const invalidWalletCases: InvalidPayloadCase[] = [
    {
      description: 'missing',
      payload: { context: 'connect' },
      expectedError: 'Invalid input: expected string, received undefined',
    },
    {
      description: 'empty',
      payload: { wallet: '', context: 'connect' },
      expectedError: 'wallet must be a valid EVM address',
    },
    {
      description: 'invalid string',
      payload: { wallet: 'invalid-address', context: 'connect' },
      expectedError: 'wallet must be a valid EVM address',
    },
    {
      description: 'short hex',
      payload: { wallet: '0x123', context: 'connect' },
      expectedError: 'wallet must be a valid EVM address',
    },
    {
      description: 'invalid checksum uppercase',
      payload: { wallet: '0x9E3663D0A9F97CDE94E22407D603782B7E7101ED', context: 'connect' },
      expectedError: 'wallet must be a valid EVM address',
    },
  ];

  for (const { description, payload, expectedError } of invalidWalletCases) {
    test(`should return 400 bad request when wallet is ${description}`, async ({
      request,
      baseURL,
    }) => {
      const response = await request.post('/api/compliance/screen', {
        headers: getOriginHeader(baseURL),
        data: payload,
      });

      await expect(response).toHaveStatusCode(400);

      const body = await response.json();
      expect(body).toEqual({ error: expectedError });
    });
  }

  const invalidContextCases: Omit<InvalidPayloadCase, 'expectedError'>[] = [
    { description: 'missing', payload: { wallet: validAddress } },
    { description: 'empty', payload: { wallet: validAddress, context: '' } },
    { description: 'invalid string', payload: { wallet: validAddress, context: 'swap' } },
  ];

  for (const { description, payload } of invalidContextCases) {
    test(`should return 400 bad request when context is ${description}`, async ({
      request,
      baseURL,
    }) => {
      const response = await request.post('/api/compliance/screen', {
        headers: getOriginHeader(baseURL),
        data: payload,
      });

      await expect(response).toHaveStatusCode(400);

      const body = await response.json();
      expect(body).toEqual({
        error: 'Invalid option: expected one of "connect"|"perps-submit"',
      });
    });
  }

  test('should return 400 bad request for malformed JSON payload', async ({ request, baseURL }) => {
    const response = await request.post('/api/compliance/screen', {
      headers: {
        ...getOriginHeader(baseURL),
        'content-type': 'application/json',
      },
      data: '{invalid json',
    });

    await expect(response).toHaveStatusCode(400);

    const body = await response.json();
    expect(body).toEqual({ error: 'Invalid input: expected object, received string' });
  });

  const unsupportedMethods = ['get', 'put', 'delete', 'patch'] as const;

  for (const method of unsupportedMethods) {
    test(`should return 405 method not allowed for ${method.toUpperCase()} request`, async ({
      request,
    }) => {
      const response = await request[method]('/api/compliance/screen');

      await expect(response).toHaveStatusCode(405);
    });
  }
});
