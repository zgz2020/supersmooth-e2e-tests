import { JSONSchemaType } from 'ajv';
import type { TokenPricesCurrentResponse } from '../../types/api/tokenPricesCurrent.ts';

export const tokenPricesCurrentSchema: JSONSchemaType<TokenPricesCurrentResponse> = {
  type: 'object',
  properties: {
    prices: {
      type: 'object',
      required: [],
      additionalProperties: { type: 'number' },
    },
  },
  required: ['prices'],
};
