import type { Address } from './common.js';

export interface TermsAcceptPayload {
  wallet: Address;
  signature: string;
  nonce: string;
  issuedAt: number;
}
