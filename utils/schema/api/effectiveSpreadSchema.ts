import { JSONSchemaType } from 'ajv';
import { EffectiveSpreadResponse } from '../../types/api/effectiveSpread.ts';

export const effectiveSpreadSchema: JSONSchemaType<EffectiveSpreadResponse> = {
  type: 'object',
  properties: {
    spreadBps: { anyOf: [{ type: 'number' }, { type: 'null', nullable: true }] },
  },
  required: ['spreadBps'],
};
