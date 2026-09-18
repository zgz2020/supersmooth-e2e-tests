import type { Hash } from './common.js';

export interface TermsStatusResponse {
  enforced: boolean;
  signed: boolean;
  termsHash: Hash;
  termsVersion: string;
}
