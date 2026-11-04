import { test, expect } from '@playwright/test';
import type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcLog,
  JsonRpcTransactionReceipt,
} from '../../utils/types/api/rpc';
import {
  jsonRpcResponseSchema,
  jsonRpcLogSchema,
  jsonRpcReceiptSchema,
} from '../../utils/schema/api/rpcSchema';
import { validateSchema } from '../../utils/schema/validator';
import {
  decodeRevertReason,
  ERROR_STRING_SELECTOR,
  PANIC_SELECTOR,
} from '../../utils/rpc/revertDecoder';
import '../../utils/assertions/matchers';

const supportedChainIds = [
  { name: 'Ethereum Mainnet', chainId: 1 },
  { name: 'Optimism', chainId: 10 },
  { name: 'Base', chainId: 8453 },
  { name: 'Arbitrum', chainId: 42161 },
];

const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const TRANSFER_EVENT_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const APPROVAL_EVENT_TOPIC = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925';

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

  test.describe('Smart Contract Read & Revert Error Decoding', () => {
    test('should execute eth_call to query ERC-20 contract decimals on Base', async ({
      request,
    }) => {
      // 0x313ce567 is the keccak-256 selector for decimals()
      const rpcPayload: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 101,
        method: 'eth_call',
        params: [
          {
            to: BASE_USDC_ADDRESS,
            data: '0x313ce567',
          },
          'latest',
        ],
      };

      const response = await request.post('/api/rpc/8453', {
        data: rpcPayload,
      });

      await expect(response).toHaveStatusCode(200);

      const body: JsonRpcResponse<string> = await response.json();
      await validateSchema({ schema: jsonRpcResponseSchema, json: body });

      expect(body.jsonrpc).toBe('2.0');
      expect(body.id).toBe(101);
      expect(body.result).toBeDefined();

      // USDC on Base has 6 decimals -> 0x00...06
      const decimals = parseInt(body.result ?? '0x0', 16);
      expect(decimals, 'USDC decimals should be 6').toBe(6);
    });

    test('should decode contract execution revert (0x08c379a0 Error(string)) on unauthorized transfer', async ({
      request,
    }) => {
      // Attempting transfer from 0x0 zero address causes an execution revert
      // transfer(address,uint256) selector: 0xa9059cbb
      const rpcPayload: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 102,
        method: 'eth_call',
        params: [
          {
            to: BASE_USDC_ADDRESS,
            from: '0x0000000000000000000000000000000000000000',
            data: '0xa9059cbb00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001',
          },
          'latest',
        ],
      };

      const response = await request.post('/api/rpc/8453', {
        data: rpcPayload,
      });

      await expect(response).toHaveStatusCode(200);

      const body: JsonRpcResponse = await response.json();
      await validateSchema({ schema: jsonRpcResponseSchema, json: body });

      expect(body.jsonrpc).toBe('2.0');
      expect(body.id).toBe(102);
      expect(body.error, 'Response should contain revert error object').toBeDefined();
      expect(body.error?.code).toBe(3);
      expect(body.error?.message).toContain('execution reverted');

      // Assert error.data contains 0x08c379a0 Error(string) selector
      const errorData = String(body.error?.data ?? '');
      expect(errorData.toLowerCase()).toContain(ERROR_STRING_SELECTOR);

      // Decode revert reason using our custom revert decoder
      const decoded = decodeRevertReason(errorData);
      expect(decoded.type).toBe('Error');
      expect(decoded.selector).toBe(ERROR_STRING_SELECTOR);
      expect(decoded.message).toContain('transfer from the zero address');
    });

    test('should accurately decode Solidity Panic(uint256) codes and reasons', () => {
      // Panic(uint256) selector: 0x4e487b71
      // Code 0x12: Division or modulo by zero
      const panicDivisionByZero =
        '0x4e487b710000000000000000000000000000000000000000000000000000000000000012';
      const decodedDivision = decodeRevertReason(panicDivisionByZero);
      expect(decodedDivision.type).toBe('Panic');
      expect(decodedDivision.selector).toBe(PANIC_SELECTOR);
      expect(decodedDivision.code).toBe(0x12);
      expect(decodedDivision.reason).toBe('Division or modulo by zero');

      // Code 0x11: Arithmetic operation underflowed or overflowed
      const panicOverflow =
        '0x4e487b710000000000000000000000000000000000000000000000000000000000000011';
      const decodedOverflow = decodeRevertReason(panicOverflow);
      expect(decodedOverflow.type).toBe('Panic');
      expect(decodedOverflow.code).toBe(0x11);
      expect(decodedOverflow.reason).toBe('Arithmetic operation underflowed or overflowed');

      // Code 0x01: Assert evaluated to false
      const panicAssert =
        '0x4e487b710000000000000000000000000000000000000000000000000000000000000001';
      const decodedAssert = decodeRevertReason(panicAssert);
      expect(decodedAssert.type).toBe('Panic');
      expect(decodedAssert.code).toBe(0x01);
      expect(decodedAssert.reason).toBe('Assert evaluated to false');

      // Custom error selector
      const customError = '0x12345678abcdef00';
      const decodedCustom = decodeRevertReason(customError);
      expect(decodedCustom.type).toBe('Custom');
      expect(decodedCustom.selector).toBe('0x12345678');

      // Malformed / non-hex input
      const invalidData = decodeRevertReason('not-a-hex');
      expect(invalidData.type).toBe('Unknown');
    });
  });

  test.describe('Smart Contract Event Logs & Transaction Receipts', () => {
    test('should filter contract logs via eth_getLogs for Transfer and Approval topics', async ({
      request,
    }) => {
      // 1. Fetch latest block number
      const blockNumRes = await request.post('/api/rpc/8453', {
        data: {
          jsonrpc: '2.0',
          id: 201,
          method: 'eth_blockNumber',
          params: [],
        },
      });
      await expect(blockNumRes).toHaveStatusCode(200);
      const blockNumBody: JsonRpcResponse<string> = await blockNumRes.json();
      const latestBlock = parseInt(blockNumBody.result ?? '0x0', 16);
      expect(latestBlock).toBeGreaterThan(0);

      // Query past 3 blocks for USDC Transfer or Approval events
      const fromBlock = `0x${(latestBlock - 3).toString(16)}`;
      const toBlock = `0x${latestBlock.toString(16)}`;

      const logsRes = await request.post('/api/rpc/8453', {
        data: {
          jsonrpc: '2.0',
          id: 202,
          method: 'eth_getLogs',
          params: [
            {
              address: BASE_USDC_ADDRESS,
              topics: [[TRANSFER_EVENT_TOPIC, APPROVAL_EVENT_TOPIC]],
              fromBlock,
              toBlock,
            },
          ],
        },
      });

      await expect(logsRes).toHaveStatusCode(200);

      const logsBody: JsonRpcResponse<JsonRpcLog[]> = await logsRes.json();
      await validateSchema({ schema: jsonRpcResponseSchema, json: logsBody });

      expect(Array.isArray(logsBody.result)).toBe(true);
      expect(logsBody.result!.length).toBeGreaterThan(0);

      const sampleLog = logsBody.result![0];
      await validateSchema({ schema: jsonRpcLogSchema, json: sampleLog });

      expect(sampleLog.address.toLowerCase()).toBe(BASE_USDC_ADDRESS.toLowerCase());
      expect([TRANSFER_EVENT_TOPIC, APPROVAL_EVENT_TOPIC]).toContain(sampleLog.topics[0]);
      expect(sampleLog.transactionHash).toMatch(/^0x[0-9a-fA-F]{64}$/);
      expect(sampleLog.blockHash).toMatch(/^0x[0-9a-fA-F]{64}$/);
    });

    test('should fetch and validate transaction receipt structure via eth_getTransactionReceipt', async ({
      request,
    }) => {
      // 1. Query block with transaction hashes
      const blockRes = await request.post('/api/rpc/8453', {
        data: {
          jsonrpc: '2.0',
          id: 301,
          method: 'eth_getBlockByNumber',
          params: ['latest', false],
        },
      });
      await expect(blockRes).toHaveStatusCode(200);
      const blockBody: JsonRpcResponse<{ transactions: string[] }> = await blockRes.json();
      expect(blockBody.result?.transactions?.length).toBeGreaterThan(0);

      const txHash = blockBody.result!.transactions[0];
      expect(txHash).toMatch(/^0x[0-9a-fA-F]{64}$/);

      // 2. Query transaction receipt
      const receiptRes = await request.post('/api/rpc/8453', {
        data: {
          jsonrpc: '2.0',
          id: 302,
          method: 'eth_getTransactionReceipt',
          params: [txHash],
        },
      });

      await expect(receiptRes).toHaveStatusCode(200);

      const receiptBody: JsonRpcResponse<JsonRpcTransactionReceipt> = await receiptRes.json();
      await validateSchema({ schema: jsonRpcResponseSchema, json: receiptBody });

      const receipt = receiptBody.result!;
      expect(receipt).toBeDefined();
      await validateSchema({ schema: jsonRpcReceiptSchema, json: receipt });

      expect(receipt.transactionHash.toLowerCase()).toBe(txHash.toLowerCase());
      expect(['0x1', '0x0']).toContain(receipt.status);
      expect(receipt.gasUsed).toMatch(/^0x[0-9a-fA-F]+$/);
      expect(receipt.cumulativeGasUsed).toMatch(/^0x[0-9a-fA-F]+$/);
      // logsBloom is a 2048-bit (256-byte) hex string: 0x + 512 chars = 514 total chars
      expect(receipt.logsBloom).toHaveLength(514);
      expect(Array.isArray(receipt.logs)).toBe(true);
    });
  });

  test.describe('JSON-RPC Concurrency & Multi-Call Load', () => {
    test('should handle concurrent multi-call batch JSON-RPC requests under load with correct ID correlation', async ({
      request,
    }) => {
      const concurrency = 6;
      const promises = Array.from({ length: concurrency }, async (_, batchIdx) => {
        const idBase = (batchIdx + 1) * 100;
        const batchPayload: JsonRpcRequest[] = [
          {
            jsonrpc: '2.0',
            id: idBase + 1,
            method: 'eth_blockNumber',
            params: [],
          },
          {
            jsonrpc: '2.0',
            id: idBase + 2,
            method: 'eth_chainId',
            params: [],
          },
        ];

        const start = Date.now();
        const response = await request.post('/api/rpc/8453', {
          data: batchPayload,
        });
        const duration = Date.now() - start;

        expect(response.status()).toBe(200);
        const body: JsonRpcResponse[] = await response.json();
        expect(Array.isArray(body)).toBe(true);
        expect(body).toHaveLength(2);

        const returnedIds = body.map((r) => r.id);
        expect(returnedIds).toContain(idBase + 1);
        expect(returnedIds).toContain(idBase + 2);

        return { duration, ok: true };
      });

      const concurrentResponses = await Promise.all(promises);
      // eslint-disable-next-line playwright/prefer-to-have-count
      expect(concurrentResponses).toHaveLength(concurrency);
      for (const res of concurrentResponses) {
        expect(res.ok).toBe(true);
        expect(res.duration).toBeLessThan(5000);
      }
    });
  });

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
