import type { JSONSchemaType } from 'ajv';
import type { PortfolioSummaryResponse } from '../../types/api/portfolioSummary';

export const portfolioSummarySchema: JSONSchemaType<PortfolioSummaryResponse> = {
  type: 'object',
  properties: {
    supersmoothPortfolioUsd: { type: 'number' },
    supersmoothPortfolioChange7d: { anyOf: [{ type: 'number' }, { type: 'null', nullable: true }] },
    suppliedUsd: { type: 'number' },
    suppliedChange7d: { anyOf: [{ type: 'number' }, { type: 'null', nullable: true }] },
    borrowedUsd: { type: 'number' },
    borrowedChange7d: { anyOf: [{ type: 'number' }, { type: 'null', nullable: true }] },
    borrowedChange7dUsd: { type: 'number' },
    chainBreakdown: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          chainId: { type: 'number' },
          valueUsd: { type: 'number' },
          sharePercent: { type: 'number' },
        },
        required: ['chainId', 'valueUsd', 'sharePercent'],
      },
    },
  },
  required: [
    'supersmoothPortfolioUsd',
    'supersmoothPortfolioChange7d',
    'suppliedUsd',
    'suppliedChange7d',
    'borrowedUsd',
    'borrowedChange7d',
    'borrowedChange7dUsd',
    'chainBreakdown',
  ],
};
