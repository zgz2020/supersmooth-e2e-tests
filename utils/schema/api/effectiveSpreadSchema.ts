import type { JSONSchemaType } from 'ajv';
import type { EffectiveSpreadResponse } from '../../types/api/effectiveSpread';

export const effectiveSpreadSchema: JSONSchemaType<EffectiveSpreadResponse> = {
  type: 'object',
  properties: {
    spreadBps: { anyOf: [{ type: 'number' }, { type: 'null', nullable: true }] },
  },
  required: ['spreadBps'],
};
