import type { Address } from './common';

export interface TermsAcceptPayload {
  wallet: Address;
  signature: string;
  nonce: string;
  issuedAt: number;
}
