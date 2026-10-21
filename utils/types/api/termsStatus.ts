import type { Hash } from './common';

export interface TermsStatusResponse {
  enforced: boolean;
  signed: boolean;
  termsHash: Hash;
  termsVersion: string;
}
