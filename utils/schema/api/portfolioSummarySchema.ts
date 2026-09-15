import { JSONSchemaType } from 'ajv';
import { PortfolioSummary } from '../../types/api/portfolioSummary.js';

export const portfolioSummarySchema: JSONSchemaType<PortfolioSummary> = {
  type: 'object',
  properties: {
    supersmoothPortfolioUsd: { type: 'number' },
    supersmoothPortfolioChange7d: { type: 'number', nullable: true } as any,
    suppliedUsd: { type: 'number' },
    suppliedChange7d: { type: 'number', nullable: true } as any,
    borrowedUsd: { type: 'number' },
    borrowedChange7d: { type: 'number', nullable: true } as any,
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

