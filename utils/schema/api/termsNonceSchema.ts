import { JSONSchemaType } from 'ajv';
import type { TermsNonceResponse } from '../../types/api/termsNonce';

export const termsNonceSchema: JSONSchemaType<TermsNonceResponse> = {
  type: 'object',
  properties: {
    nonce: { type: 'string', pattern: '^[a-fA-F0-9]{32}\\.[a-fA-F0-9]{64}$' },
    issuedAt: { type: 'number' },
  },
  required: ['nonce', 'issuedAt'],
};
