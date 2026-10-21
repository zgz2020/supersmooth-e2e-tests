import { JSONSchemaType } from 'ajv';
import type { ProductTableTopCardsResponse } from '../../types/api/productTableTopCards';

export const productTableTopCardsSchema: JSONSchemaType<ProductTableTopCardsResponse> = {
  type: 'object',
  properties: {
    cards: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          tokens: {
            type: 'array',
            items: { type: 'string' },
          },
          network: { type: 'string', nullable: true },
          protocol: { type: 'string', nullable: true },
          oracle: { type: 'string', nullable: true },
          automations: { type: 'object', required: [], additionalProperties: true },
          marketedLabel: { type: 'string' },
          marketedValue: { type: 'string' },
          marketedSubValue: { type: 'number', nullable: true },
          tvl: { type: 'string', nullable: true },
          footerLabel: { type: 'string', nullable: true },
          maxDeposit: { type: 'string', nullable: true },
          maxDepositSubValue: { type: 'string', nullable: true },
          url: { type: 'string' },
        },
        required: ['id', 'title', 'tokens', 'automations', 'marketedLabel', 'marketedValue', 'url'],
      },
    },
  },
  required: ['cards'],
};
