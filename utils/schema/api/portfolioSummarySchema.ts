import { JSONSchemaType } from 'ajv';

export interface ChainBreakdown {
  chainId: number;
  valueUsd: number;
  sharePercent: number;
}

export interface PortfolioSummary {
  supersmoothPortfolioUsd: number;
  supersmoothPortfolioChange7d: number;
  suppliedUsd: number;
  suppliedChange7d: number;
  borrowedUsd: number;
  borrowedChange7d: number;
  borrowedChange7dUsd: number;
  chainBreakdown: ChainBreakdown[];
}

export const portfolioSummarySchema: JSONSchemaType<PortfolioSummary> = {
  type: 'object',
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
  properties: {
    supersmoothPortfolioUsd: { type: 'number' },
    supersmoothPortfolioChange7d: { type: 'number' },
    suppliedUsd: { type: 'number' },
    suppliedChange7d: { type: 'number' },
    borrowedUsd: { type: 'number' },
    borrowedChange7d: { type: 'number' },
    borrowedChange7dUsd: { type: 'number' },
    chainBreakdown: {
      type: 'array',
      items: {
        type: 'object',
        required: ['chainId', 'valueUsd', 'sharePercent'],
        properties: {
          chainId: { type: 'number' },
          valueUsd: { type: 'number' },
          sharePercent: { type: 'number' },
        },
      },
    },
  },
};
