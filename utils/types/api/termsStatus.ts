import type { Hash } from './common.ts';

export interface TermsStatusResponse {
  enforced: boolean;
  signed: boolean;
  termsHash: Hash;
  termsVersion: string;
}
