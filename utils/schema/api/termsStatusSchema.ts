import type { JSONSchemaType } from 'ajv';
import type { TermsStatusResponse } from '../../types/api/termsStatus';

export const termsStatusSchema: JSONSchemaType<TermsStatusResponse> = {
  type: 'object',
  properties: {
    enforced: { type: 'boolean' },
    signed: { type: 'boolean' },
    termsHash: { type: 'string', pattern: '^0x[a-fA-F0-9]{64}$' },
    termsVersion: { type: 'string' },
  },
  required: ['enforced', 'signed', 'termsHash', 'termsVersion'],
};
