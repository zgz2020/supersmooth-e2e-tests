import { AnySchemaObject } from 'ajv';

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
