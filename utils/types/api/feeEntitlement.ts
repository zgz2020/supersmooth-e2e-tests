import type { Address, Hash } from './common';

export interface FeeEntitlementRequest {
  chainId: number;
  safe: Address;
  scope: 'swap' | 'spread';
  /** On-chain FeeManager swap fee profile: 1 = standard position swap, 6 = refinance */
  profile: number;
  context?: {
    sellToken?: Address;
    /** Swap amount in the token's smallest unit, as a decimal string */
    sellAmountWei?: string;
  };
}

export interface FeeEntitlement {
  domain: Hash;
  marketKey: Hash;
  profile: number;
  flags: number;
  /** Discount on `baseFeeBps`, in bps of the fee: effective fee = floor(base × (10000 − d) / 10000) */
  swapDiscountBps: number;
  spreadDiscountBps: number;
  /** Unix seconds, as a decimal string */
  validUntil: string;
  /** Unix seconds, as a decimal string */
  expiry: string;
  sig: Hash;
}

export interface FeeEntitlementResponse {
  entitlement: FeeEntitlement;
  sig: Hash;
  blob: Hash;
  /** Undiscounted fee (bps) of the requested profile, read on-chain */
  baseFeeBps: number;
}

export interface FeeEntitlementErrorResponse {
  error: string;
}
