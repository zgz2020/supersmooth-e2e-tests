import { JSONSchemaType } from 'ajv';
import type { MigrateAdoptableSafesResponse } from '../../types/api/migrateAdoptableSafes.js';

export const migrateAdoptableSafesSchema: JSONSchemaType<MigrateAdoptableSafesResponse> = {
  type: 'object',
  properties: {
    safes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          safe: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
          chainId: { type: 'number' },
          usesDefiSaver: { type: 'boolean' },
          position: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              chainId: { type: 'number' },
              protocol: { type: 'string' },
              marketIdentifier: { type: 'string' },
              positionId: { anyOf: [{ type: 'string' }, { type: 'null', nullable: true }] },
              collateral: {
                type: 'object',
                properties: {
                  address: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
                  symbol: { type: 'string' },
                  decimals: { type: 'number' },
                  amount: { type: 'string' },
                  usd: { anyOf: [{ type: 'number' }, { type: 'null', nullable: true }] },
                },
                required: ['address', 'symbol', 'decimals', 'amount', 'usd'],
              },
              debt: {
                type: 'object',
                properties: {
                  address: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
                  symbol: { type: 'string' },
                  decimals: { type: 'number' },
                  amount: { type: 'string' },
                  usd: { anyOf: [{ type: 'number' }, { type: 'null', nullable: true }] },
                },
                required: ['address', 'symbol', 'decimals', 'amount', 'usd'],
              },
              netValueUsd: { anyOf: [{ type: 'number' }, { type: 'null', nullable: true }] },
              ltv: { type: 'number' },
              maxLtv: { type: 'number' },
              maxLtvWad: { type: 'string' },
              liquidationPriceUsd: { type: 'number' },
              borrowRate: { anyOf: [{ type: 'number' }, { type: 'null', nullable: true }] },
              collateralSupplyApy: {
                anyOf: [{ type: 'number' }, { type: 'null', nullable: true }],
              },
              sourceEmode: { anyOf: [{ type: 'number' }, { type: 'null', nullable: true }] },
              products: {
                type: 'object',
                properties: {
                  borrow: { type: 'boolean' },
                  multiply: { type: 'boolean' },
                },
                required: ['borrow', 'multiply'],
              },
              blockNumber: { anyOf: [{ type: 'string' }, { type: 'null', nullable: true }] },
              unsupportedReason: {
                anyOf: [{ type: 'string' }, { type: 'null', nullable: true }],
              },
            },
            required: [
              'id',
              'chainId',
              'protocol',
              'marketIdentifier',
              'positionId',
              'collateral',
              'debt',
              'netValueUsd',
              'ltv',
              'maxLtv',
              'maxLtvWad',
              'liquidationPriceUsd',
              'borrowRate',
              'collateralSupplyApy',
              'sourceEmode',
              'products',
              'blockNumber',
              'unsupportedReason',
            ],
          },
          holdsOtherPositions: { type: 'boolean' },
          otherAutomations: { anyOf: [{ type: 'number' }, { type: 'null', nullable: true }] },
        },
        required: [
          'safe',
          'chainId',
          'usesDefiSaver',
          'position',
          'holdsOtherPositions',
          'otherAutomations',
        ],
      },
    },
  },
  required: ['safes'],
};
