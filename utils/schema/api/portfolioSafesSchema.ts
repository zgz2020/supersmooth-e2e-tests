import { JSONSchemaType } from 'ajv';
import { PortfolioSafesResponse } from '../../types/api/portfolioSafes';

export const portfolioSafesSchema: JSONSchemaType<PortfolioSafesResponse[]> = {
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
            protocol: {
              type: 'string',
              enum: ['morpho', 'euler', 'compoundV3', 'aaveV3', 'spark', 'aaveV3Lido', 'fluid'],
            },
            chainId: { type: 'number' },
            tokens: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  role: { type: 'string', enum: ['Collateral', 'Debt', 'Deposit'] },
                  address: { type: 'string' },
                  amount: { type: 'string', nullable: true },
                  operation: {
                    type: 'string',
                    enum: ['Supply', 'Borrow', 'Withdraw', 'Repay', 'Deposit'],
                  },
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
                netValueUsd: { anyOf: [{ type: 'number' }, { type: 'null', nullable: true }] },
                collateralUsd: { anyOf: [{ type: 'number' }, { type: 'null', nullable: true }] },
                debtUsd: { anyOf: [{ type: 'number' }, { type: 'null', nullable: true }] },
                suppliedUsd: { anyOf: [{ type: 'number' }, { type: 'null', nullable: true }] },
              },
              required: ['netValueUsd', 'collateralUsd', 'debtUsd', 'suppliedUsd'],
            },
            latestSnapshot: {
              type: 'object',
              properties: {
                netValueUsd: { anyOf: [{ type: 'number' }, { type: 'null', nullable: true }] },
                collateralUsd: { anyOf: [{ type: 'number' }, { type: 'null', nullable: true }] },
                debtUsd: { anyOf: [{ type: 'number' }, { type: 'null', nullable: true }] },
                suppliedUsd: { anyOf: [{ type: 'number' }, { type: 'null', nullable: true }] },
              },
              required: ['netValueUsd', 'collateralUsd', 'debtUsd', 'suppliedUsd'],
            },
            earnDepositFlow: {
              anyOf: [
                { type: 'object', required: [] },
                { type: 'null', nullable: true },
              ],
            },
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
