import type { JSONSchemaType } from 'ajv';
import type { FeeEntitlementResponse } from '../../types/api/feeEntitlement';

const bytes32 = { type: 'string', pattern: '^0x[a-fA-F0-9]{64}$' } as const;
const signature = { type: 'string', pattern: '^0x[a-fA-F0-9]{130}$' } as const;
const unixSeconds = { type: 'string', pattern: '^[0-9]+$' } as const;
const bps = { type: 'integer', minimum: 0, maximum: 10_000 } as const;

export const feeEntitlementSchema: JSONSchemaType<FeeEntitlementResponse> = {
  type: 'object',
  properties: {
    entitlement: {
      type: 'object',
      properties: {
        domain: bytes32,
        marketKey: bytes32,
        profile: { type: 'integer', minimum: 0, maximum: 255 },
        flags: { type: 'integer', minimum: 0 },
        swapDiscountBps: bps,
        spreadDiscountBps: bps,
        validUntil: unixSeconds,
        expiry: unixSeconds,
        sig: signature,
      },
      required: [
        'domain',
        'marketKey',
        'profile',
        'flags',
        'swapDiscountBps',
        'spreadDiscountBps',
        'validUntil',
        'expiry',
        'sig',
      ],
    },
    sig: signature,
    blob: { type: 'string', pattern: '^0x[a-fA-F0-9]+$' },
    baseFeeBps: bps,
  },
  required: ['entitlement', 'sig', 'blob', 'baseFeeBps'],
};
