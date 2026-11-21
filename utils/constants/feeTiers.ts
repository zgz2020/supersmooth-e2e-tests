/**
 * Published Supersmooth swap fee schedules (https://supersmooth.mintlify.site/fees), the expected
 * values for `/api/fee-entitlement`. A swap gets the tier of its whole USD notional, and a tier
 * starts at its `minNotionalUsd` (inclusive).
 */
export type FeeTier = {
  minNotionalUsd: number;
  feeBps: number;
  /**
   * `swapDiscountBps` the server signs for the tier: the smallest discount on the base fee that
   * brings `effectiveSwapFeeBps` down to `feeBps` (e.g. 30 → 25 bps needs 1334, as 1333 leaves 26).
   */
  discountBps: number;
};

export type SwapFeeSchedule = {
  /** On-chain FeeManager swap fee profile the schedule is priced on */
  profile: number;
  /** Undiscounted profile fee: the first tier's fee */
  baseFeeBps: number;
  tiers: readonly FeeTier[];
};

export const POSITION_SWAP_FEE_SCHEDULE: SwapFeeSchedule = {
  profile: 1,
  baseFeeBps: 30,
  tiers: [
    { minNotionalUsd: 0, feeBps: 30, discountBps: 0 },
    { minNotionalUsd: 100_000, feeBps: 25, discountBps: 1334 },
    { minNotionalUsd: 1_000_000, feeBps: 15, discountBps: 4667 },
    { minNotionalUsd: 10_000_000, feeBps: 5, discountBps: 8001 },
  ],
};

export const REFINANCE_SWAP_FEE_SCHEDULE: SwapFeeSchedule = {
  profile: 6,
  baseFeeBps: 15,
  tiers: [
    { minNotionalUsd: 0, feeBps: 15, discountBps: 0 },
    { minNotionalUsd: 1_000_000, feeBps: 10, discountBps: 2667 },
    { minNotionalUsd: 10_000_000, feeBps: 5, discountBps: 6001 },
    { minNotionalUsd: 100_000_000, feeBps: 2, discountBps: 8001 },
  ],
};

/** Effective fee the FeeManager charges for a discount: floor(base × (10000 − d) / 10000). */
export const effectiveSwapFeeBps = (baseFeeBps: number, discountBps: number): number =>
  Math.floor((baseFeeBps * (10_000 - discountBps)) / 10_000);
