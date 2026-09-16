import { JSONSchemaType } from 'ajv';
import { PortfolioSafe } from '../../types/api/portfolioSafes.js';

export const portfolioSafesSchema: JSONSchemaType<PortfolioSafe[]> = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      address: { type: 'string' },
      createdAt: { type: 'string' },
      positions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            market: { type: 'string' },
            product: { type: 'string', enum: ['Multiply', 'Borrow', 'Earn'] },
            protocol: { type: 'string', enum: ['morpho', 'euler', 'compoundV3', 'aaveV3'] },
            chainId: { type: 'number' },
            tokens: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  role: { type: 'string', enum: ['Collateral', 'Debt'] },
                  address: { type: 'string' },
                  amount: { type: 'string', nullable: true },
                  operation: { type: 'string', enum: ['Supply', 'Borrow', 'Withdraw', 'Repay'] },
                },
                required: ['role', 'address', 'operation'],
              },
            },
            isActive: { type: 'boolean' },
            openedAt: { type: 'string' },
            closedAt: { anyOf: [{ type: 'string' }, { type: 'null', nullable: true }] },
            openingSnapshot: {
              type: 'object',
              properties: {
                netValueUsd: { type: 'number' },
                collateralUsd: { type: 'number' },
                debtUsd: { type: 'number' },
                suppliedUsd: { anyOf: [{ type: 'number' }, { type: 'null', nullable: true }] },
              },
              required: ['netValueUsd', 'collateralUsd', 'debtUsd', 'suppliedUsd'],
            },
            latestSnapshot: {
              type: 'object',
              properties: {
                netValueUsd: { type: 'number' },
                collateralUsd: { type: 'number' },
                debtUsd: { type: 'number' },
                suppliedUsd: { anyOf: [{ type: 'number' }, { type: 'null', nullable: true }] },
              },
              required: ['netValueUsd', 'collateralUsd', 'debtUsd', 'suppliedUsd'],
            },
            earnDepositFlow: { anyOf: [{ type: 'object', required: [] }, { type: 'null', nullable: true }] },
            automations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  triggerType: { anyOf: [{ type: 'string' }, { type: 'null', nullable: true }] },
                  enabled: { type: 'boolean' },
                },
                required: ['id', 'triggerType', 'enabled'],
              },
            },
            dataQuality: {
              type: 'object',
              properties: {
                source: { type: 'string' },
                historicalSnapshotsDegraded: { type: 'boolean' },
                pnlDegraded: { type: 'boolean' },
              },
              required: ['source', 'historicalSnapshotsDegraded', 'pnlDegraded'],
            },
          },
          required: [
            'id',
            'market',
            'product',
            'protocol',
            'chainId',
            'tokens',
            'isActive',
            'openedAt',
            'closedAt',
            'openingSnapshot',
            'latestSnapshot',
            'earnDepositFlow',
            'automations',
            'dataQuality',
          ],
        },
      },
    },
    required: ['id', 'address', 'createdAt', 'positions'],
  },
};
