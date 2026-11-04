import type { AnySchemaObject } from 'ajv';

export const jsonRpcResponseSchema: AnySchemaObject = {
  type: 'object',
  properties: {
    jsonrpc: { type: 'string', const: '2.0' },
    id: { type: ['number', 'string'] },
    result: { type: ['string', 'number', 'object', 'array', 'boolean', 'null'] },
    error: {
      type: ['object', 'null'],
      properties: {
        code: { type: 'number' },
        message: { type: 'string' },
        data: {},
      },
      required: ['code', 'message'],
    },
  },
  required: ['jsonrpc', 'id'],
};

export const jsonRpcLogSchema: AnySchemaObject = {
  type: 'object',
  properties: {
    address: { type: 'string', pattern: '^0x[0-9a-fA-F]{40}$' },
    topics: {
      type: 'array',
      items: { type: 'string', pattern: '^0x[0-9a-fA-F]{64}$' },
    },
    data: { type: 'string', pattern: '^0x[0-9a-fA-F]*$' },
    blockNumber: { type: 'string', pattern: '^0x[0-9a-fA-F]+$' },
    transactionHash: { type: 'string', pattern: '^0x[0-9a-fA-F]{64}$' },
    transactionIndex: { type: 'string', pattern: '^0x[0-9a-fA-F]+$' },
    blockHash: { type: 'string', pattern: '^0x[0-9a-fA-F]{64}$' },
    logIndex: { type: 'string', pattern: '^0x[0-9a-fA-F]+$' },
    removed: { type: 'boolean' },
  },
  required: [
    'address',
    'topics',
    'data',
    'blockNumber',
    'transactionHash',
    'blockHash',
    'logIndex',
  ],
};

export const jsonRpcReceiptSchema: AnySchemaObject = {
  type: 'object',
  properties: {
    transactionHash: { type: 'string', pattern: '^0x[0-9a-fA-F]{64}$' },
    transactionIndex: { type: 'string', pattern: '^0x[0-9a-fA-F]+$' },
    blockHash: { type: 'string', pattern: '^0x[0-9a-fA-F]{64}$' },
    blockNumber: { type: 'string', pattern: '^0x[0-9a-fA-F]+$' },
    from: { type: 'string', pattern: '^0x[0-9a-fA-F]{40}$' },
    to: { type: ['string', 'null'] },
    cumulativeGasUsed: { type: 'string', pattern: '^0x[0-9a-fA-F]+$' },
    gasUsed: { type: 'string', pattern: '^0x[0-9a-fA-F]+$' },
    effectiveGasPrice: { type: 'string', pattern: '^0x[0-9a-fA-F]+$' },
    contractAddress: { type: ['string', 'null'] },
    logs: { type: 'array' },
    logsBloom: { type: 'string', pattern: '^0x[0-9a-fA-F]+$' },
    type: { type: 'string' },
    status: { type: 'string', pattern: '^0x[01]$' },
  },
  required: [
    'transactionHash',
    'blockHash',
    'blockNumber',
    'cumulativeGasUsed',
    'gasUsed',
    'logsBloom',
    'status',
  ],
};
