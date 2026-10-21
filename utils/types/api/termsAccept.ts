import type { Address } from './common.ts';

export interface TermsAcceptPayload {
  wallet: Address;
  signature: string;
  nonce: string;
  issuedAt: number;
}
