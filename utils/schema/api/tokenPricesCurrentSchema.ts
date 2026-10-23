import type { JSONSchemaType } from 'ajv';
import type { TokenPricesCurrentResponse } from '../../types/api/tokenPricesCurrent';

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
