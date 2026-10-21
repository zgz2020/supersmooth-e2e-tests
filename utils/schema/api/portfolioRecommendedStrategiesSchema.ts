import { JSONSchemaType } from 'ajv';
import { PortfolioRecommendedStrategies } from '../../types/api/portfolioRecommendedStrategies.ts';

export const portfolioRecommendedStrategiesSchema: JSONSchemaType<PortfolioRecommendedStrategies> =
  {
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
            network: { type: 'string', enum: ['ethereum', 'base', 'arbitrum', 'optimism'] },
            protocol: {
              type: 'string',
              enum: ['morpho', 'euler', 'compoundV3', 'aaveV3', 'spark'],
            },
            oracle: {
              type: 'string',
              enum: ['morpho-oracle', 'euler-router', 'chainlink', 'pyth'],
            },
            automations: { type: 'object', required: [], additionalProperties: true },
            tvl: { type: 'string' },
            marketedLabel: { type: 'string' },
            marketedValue: { type: 'string' },
            url: { type: 'string' },
            productType: { type: 'string', enum: ['earn', 'borrow', 'multiply'] },
          },
          required: [
            'id',
            'title',
            'tokens',
            'network',
            'protocol',
            'oracle',
            'automations',
            'tvl',
            'marketedLabel',
            'marketedValue',
            'url',
            'productType',
          ],
        },
      },
    },
    required: ['cards'],
  };
