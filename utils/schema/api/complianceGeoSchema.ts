import { JSONSchemaType } from 'ajv';
import type { ComplianceGeoResponse } from '../../types/api/complianceGeo.js';

export const complianceGeoSchema: JSONSchemaType<ComplianceGeoResponse> = {
  type: 'object',
  properties: {
    country: { anyOf: [{ type: 'string' }, { type: 'null', nullable: true }] },
    region: { anyOf: [{ type: 'string' }, { type: 'null', nullable: true }] },
    blockedSurfaces: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['country', 'region', 'blockedSurfaces'],
};
