import { test, expect } from '@playwright/test';
import type { JsonRpcRequest, JsonRpcResponse } from '../../utils/types/api/rpc';
import { jsonRpcResponseSchema } from '../../utils/schema/api/rpcSchema';
import { validateSchema } from '../../utils/schema/validator';
import '../../utils/assertions/matchers';

const supportedChainIds = [
  { name: 'Ethereum Mainnet', chainId: 1 },
  { name: 'Optimism', chainId: 10 },
  { name: 'Base', chainId: 8453 },
  { name: 'Arbitrum', chainId: 42161 },
];

test.describe('RPC API', () => {
  for (const { name, chainId } of supportedChainIds) {
    test(`should process single JSON-RPC request for ${name} (chainId: ${chainId})`, async ({
      request,
    }) => {
      const rpcPayload: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_blockNumber',
        params: [],
      };

      const response = await request.post(`/api/rpc/${chainId}`, {
        data: rpcPayload,
      });

      await expect(response).toHaveStatusCode(200);

      const headers = response.headers();
      expect(
        headers['content-type'],
        'Response content-type header should contain application/json',
      ).toContain('application/json');

      const body: JsonRpcResponse = await response.json();
      await validateSchema({ schema: jsonRpcResponseSchema, json: body });

      expect(body.jsonrpc, 'JSON-RPC version should be 2.0').toBe('2.0');
      expect(body.id, 'JSON-RPC id should match request id').toBe(1);
      expect(body.result, 'Response result should be defined').toBeDefined();
    });

    test(`should process batch JSON-RPC request for ${name} (chainId: ${chainId})`, async ({
      request,
    }) => {
      const batchPayload: JsonRpcRequest[] = [
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_blockNumber',
          params: [],
        },
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'eth_chainId',
          params: [],
        },
      ];

      const response = await request.post(`/api/rpc/${chainId}`, {
        data: batchPayload,
      });

      const headers = response.headers();
      expect(
        headers['content-type'],
        'Response content-type header should contain application/json',
      ).toContain('application/json');

      const body: JsonRpcResponse[] = await response.json();
      expect(Array.isArray(body), 'Batch response should be an array').toBe(true);
      expect(body, 'Batch response should contain 2 items').toHaveLength(2);

      const responseIds = body.map((item) => item.id);
      expect(responseIds, 'Batch response should contain responses for id 1 and 2').toEqual(
        expect.arrayContaining([1, 2]),
      );

      for (const item of body) {
        await validateSchema({ schema: jsonRpcResponseSchema, json: item });
        expect(item.jsonrpc).toBe('2.0');
        expect(item.result).toBeDefined();
      }
    });
  }

  test('should return 404 not found for unsupported chain id', async ({ request }) => {
    const response = await request.post('/api/rpc/99999', {
      data: {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_blockNumber',
        params: [],
      },
    });

    await expect(response).toHaveStatusCode(404);

    const body = await response.json();
    expect(body).toEqual({
      error: 'Unsupported chain id: 99999',
    });
  });

  test('should return 400 bad request for invalid non-numeric chain id', async ({ request }) => {
    const response = await request.post('/api/rpc/invalid', {
      data: {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_blockNumber',
        params: [],
      },
    });

    await expect(response).toHaveStatusCode(400);

    const body = await response.json();
    expect(body).toEqual({
      error: 'Invalid chain id: invalid',
    });
  });

  test('should return 400 bad request when body is empty or invalid JSON', async ({ request }) => {
    const response = await request.post('/api/rpc/8453', {
      headers: {
        'content-type': 'application/json',
      },
      data: '',
    });

    await expect(response).toHaveStatusCode(400);

    const body = await response.json();
    expect(body).toEqual({
      error: 'Malformed JSON-RPC request',
    });
  });

  test('should return 400 bad request for disallowed RPC method', async ({ request }) => {
    const response = await request.post('/api/rpc/8453', {
      data: {
        jsonrpc: '2.0',
        id: 1,
        method: 'invalid_method_xyz',
        params: [],
      },
    });

    await expect(response).toHaveStatusCode(400);

    const body = await response.json();
    expect(body).toEqual({
      error: 'Method not allowed: invalid_method_xyz',
    });
  });

  const unsupportedMethods = ['get', 'put', 'delete', 'patch'] as const;

  for (const method of unsupportedMethods) {
    test(`should return 405 method not allowed for ${method.toUpperCase()} request`, async ({
      request,
    }) => {
      const response = await request[method]('/api/rpc/8453');

      await expect(response).toHaveStatusCode(405);
    });
  }
});
