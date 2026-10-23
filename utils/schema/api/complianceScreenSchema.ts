import type { JSONSchemaType } from 'ajv';
import type { ComplianceScreenResponse } from '../../types/api/complianceScreen';

export const complianceScreenSchema: JSONSchemaType<ComplianceScreenResponse> = {
  type: 'object',
  properties: {
    screened: { type: 'boolean' },
    sanctioned: { type: 'boolean' },
    cached: { type: 'boolean' },
    logged: { type: 'boolean' },
  },
  required: ['screened', 'sanctioned', 'cached', 'logged'],
};
