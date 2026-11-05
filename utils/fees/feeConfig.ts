/**
 * utils/fees/feeConfig.ts
 *
 * Official fee configuration and tier rules for SuperSmooth DeFi protocols.
 * Reference: https://supersmooth.mintlify.site/fees
 *
 * "Position Swap Fee: Open, adjust, and close swaps on Multiply and Yield Loop positions.
 *  Tiered by that swap's notional: 30 bps below $100k, 25 bps to $1M, 15 bps to $10M, 5 bps above $10M."
 */

import type { FeeRule, FeeTier } from './types';

export const POSITION_SWAP_FEE_TIERS: readonly FeeTier[] = [
  {
    id: 'tier-1',
    name: 'Tier 1 (< $100k)',
    minNotionalUsd: 0,
    maxNotionalUsd: 100_000,
    bps: 30,
    rate: 0.003,
    description: '30 bps for swaps with notional below $100,000',
  },
  {
    id: 'tier-2',
    name: 'Tier 2 ($100k - $1M)',
    minNotionalUsd: 100_000,
    maxNotionalUsd: 1_000_000,
    bps: 25,
    rate: 0.0025,
    description: '25 bps for swaps with notional between $100,000 and $1,000,000',
  },
  {
    id: 'tier-3',
    name: 'Tier 3 ($1M - $10M)',
    minNotionalUsd: 1_000_000,
    maxNotionalUsd: 10_000_000,
    bps: 15,
    rate: 0.0015,
    description: '15 bps for swaps with notional between $1,000,000 and $10,000,000',
  },
  {
    id: 'tier-4',
    name: 'Tier 4 (> $10M)',
    minNotionalUsd: 10_000_000,
    maxNotionalUsd: Infinity,
    bps: 5,
    rate: 0.0005,
    description: '5 bps for swaps with notional exceeding $10,000,000',
  },
] as const;

export const DEFAULT_FEE_RULES: FeeRule[] = [
  {
    feeType: 'position_swap',
    category: 'multiply',
    actions: ['open', 'adjust', 'close'],
    tiers: [...POSITION_SWAP_FEE_TIERS],
    description: 'Position Swap Fee for Multiply positions across all chains and protocols',
  },
  {
    feeType: 'position_swap',
    category: 'yieldLoop',
    actions: ['open', 'adjust', 'close'],
    tiers: [...POSITION_SWAP_FEE_TIERS],
    description: 'Position Swap Fee for Yield Loop positions across all chains and protocols',
  },
];

/**
 * Representative test amounts for each fee tier to validate boundaries and mid-tier calculations.
 */
export const FEE_TIER_TEST_AMOUNTS = {
  tier1: {
    boundaryLow: 100, // $100
    mid: 50_000, // $50k
    boundaryHigh: 99_999.99, // Just below $100k
    expectedBps: 30,
  },
  tier2: {
    boundaryLow: 100_000, // Exactly $100k
    mid: 500_000, // $500k
    boundaryHigh: 999_999.99, // Just below $1M
    expectedBps: 25,
  },
  tier3: {
    boundaryLow: 1_000_000, // Exactly $1M
    mid: 5_000_000, // $5M
    boundaryHigh: 9_999_999.99, // Just below $10M
    expectedBps: 15,
  },
  tier4: {
    boundaryLow: 10_000_000, // Exactly $10M
    mid: 25_000_000, // $25M
    boundaryHigh: 100_000_000, // $100M
    expectedBps: 5,
  },
} as const;
