/**
 * utils/fees/feeEngine.ts
 *
 * Core mathematical and validation engine for DeFi fee structures.
 * Supports tiered swap fees, position notional derivation, and precision verification.
 */

import { DEFAULT_FEE_RULES, POSITION_SWAP_FEE_TIERS } from './feeConfig';
import type {
  FeeCalculationResult,
  FeeRule,
  FeeTier,
  FeeVerificationResult,
  MultiplyNotionalParams,
  MultiplyNotionalResult,
  PositionAction,
  PositionCategory,
  SupportedNetwork,
  SupportedProtocol,
} from './types';

/**
 * Calculates the swap notional and position size for a Multiply position.
 *
 * In a Multiply position:
 * Total Position Size = Deposit USD * Multiple
 * Borrowed Amount = Total Position Size - Deposit USD = Deposit USD * (Multiple - 1)
 * Swap Notional = Borrowed Amount (the borrowed asset is swapped into collateral to achieve leverage)
 */
export function calculateMultiplyNotional(params: MultiplyNotionalParams): MultiplyNotionalResult {
  const { depositAmount, depositTokenPriceUsd, multiple } = params;

  if (depositAmount <= 0) {
    throw new Error(`Deposit amount must be positive. Received: ${depositAmount}`);
  }
  if (multiple < 1) {
    throw new Error(`Multiple must be >= 1.0x. Received: ${multiple}`);
  }

  const depositUsd = depositAmount * depositTokenPriceUsd;
  const totalPositionSizeUsd = depositUsd * multiple;
  const borrowAmountUsd = totalPositionSizeUsd - depositUsd;
  const swapNotionalUsd = borrowAmountUsd;

  return {
    depositUsd,
    multiple,
    totalPositionSizeUsd,
    borrowAmountUsd,
    swapNotionalUsd,
  };
}

/**
 * Resolves the matching fee tier for a given swap notional in USD.
 *
 * Tier 1: [0, $100,000)          -> 30 bps (0.0030)
 * Tier 2: [$100,000, $1,000,000) -> 25 bps (0.0025)
 * Tier 3: [$1,000,000, $10,000,000) -> 15 bps (0.0015)
 * Tier 4: [$10,000,000, Infinity) -> 5 bps (0.0005)
 */
export function resolveSwapFeeTier(
  notionalUsd: number,
  tiers: readonly FeeTier[] = POSITION_SWAP_FEE_TIERS,
): FeeTier {
  if (notionalUsd < 0) {
    throw new Error(`Swap notional cannot be negative. Received: ${notionalUsd}`);
  }

  for (const tier of tiers) {
    if (notionalUsd >= tier.minNotionalUsd && notionalUsd < tier.maxNotionalUsd) {
      return tier;
    }
  }

  // Fallback to highest tier if notional exceeds top boundary
  return tiers[tiers.length - 1];
}

/**
 * Calculates the exact expected position swap fee for a given notional.
 */
export function calculatePositionSwapFee(options: {
  notionalUsd: number;
  category?: PositionCategory;
  action?: PositionAction;
  network?: SupportedNetwork;
  protocol?: SupportedProtocol;
  customRules?: FeeRule[];
}): FeeCalculationResult {
  const {
    notionalUsd,
    category = 'multiply',
    action = 'open',
    network,
    protocol,
    customRules = DEFAULT_FEE_RULES,
  } = options;

  const normalizedCategory = category === 'yield-loop' ? 'yieldLoop' : category;

  // Search for protocol/network specific rule or fallback to default
  const matchedRule =
    customRules.find(
      (r) =>
        (r.category === normalizedCategory || r.category === 'all') &&
        r.feeType === 'position_swap' &&
        r.actions.includes(action) &&
        (!r.network || r.network === network) &&
        (!r.protocol || r.protocol === protocol),
    ) || DEFAULT_FEE_RULES[0];

  const tier = resolveSwapFeeTier(notionalUsd, matchedRule.tiers);
  const expectedFeeUsd = Number((notionalUsd * tier.rate).toFixed(2));

  return {
    feeType: 'position_swap',
    category: normalizedCategory,
    action,
    notionalUsd,
    bps: tier.bps,
    rate: tier.rate,
    expectedFeeUsd,
    tier,
    network,
    protocol,
  };
}

/**
 * Verifies that an observed actual fee (or observed bps) matches the expected fee tier.
 * Supports configurable precision tolerance (default 0.1 bps).
 */
export function verifyFeeTier(params: {
  notionalUsd: number;
  actualFeeUsd?: number;
  actualBps?: number;
  toleranceBps?: number;
  tiers?: readonly FeeTier[];
}): FeeVerificationResult {
  const {
    notionalUsd,
    actualFeeUsd,
    actualBps,
    toleranceBps = 0.1,
    tiers = POSITION_SWAP_FEE_TIERS,
  } = params;

  const matchedTier = resolveSwapFeeTier(notionalUsd, tiers);
  const expectedBps = matchedTier.bps;
  const expectedFeeUsd = notionalUsd * matchedTier.rate;

  let observedBps = actualBps;
  if (observedBps === undefined && actualFeeUsd !== undefined) {
    observedBps =
      notionalUsd > 0
        ? (actualFeeUsd / notionalUsd) * 10_000
        : actualFeeUsd === 0
          ? expectedBps
          : Infinity;
  }

  if (observedBps === undefined) {
    return {
      isValid: false,
      notionalUsd,
      expectedBps,
      expectedFeeUsd,
      deltaBps: Infinity,
      tierMatched: matchedTier,
      reason: 'Neither actualBps nor actualFeeUsd was provided for verification.',
    };
  }

  const deltaBps = Math.abs(observedBps - expectedBps);
  const isValid = deltaBps <= toleranceBps;

  let reason = `Fee matches ${matchedTier.name}: expected ${expectedBps} bps, observed ${observedBps.toFixed(2)} bps.`;
  if (!isValid) {
    reason = `Fee MISMATCH for ${matchedTier.name}: expected ${expectedBps} bps (${matchedTier.rate * 100}%), but observed ${observedBps.toFixed(2)} bps (delta: ${deltaBps.toFixed(2)} bps, exceeds tolerance ${toleranceBps} bps).`;
  }

  return {
    isValid,
    notionalUsd,
    expectedBps,
    expectedFeeUsd,
    actualBps: observedBps,
    actualFeeUsd: actualFeeUsd ?? (notionalUsd * observedBps) / 10_000,
    deltaBps,
    tierMatched: matchedTier,
    reason,
  };
}
