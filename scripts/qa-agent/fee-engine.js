/**
 * scripts/qa-agent/fee-engine.js
 *
 * Core mathematical engine for DeFi fee structures and tiered calculations.
 * Reference: https://supersmooth.mintlify.site/fees
 */

export const POSITION_SWAP_FEE_TIERS = [
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
];

export const DEFAULT_FEE_RULES = [
  {
    feeType: 'position_swap',
    category: 'multiply',
    actions: ['open', 'adjust', 'close'],
    tiers: POSITION_SWAP_FEE_TIERS,
    description: 'Position Swap Fee for Multiply positions across all chains and protocols',
  },
  {
    feeType: 'position_swap',
    category: 'yieldLoop',
    actions: ['open', 'adjust', 'close'],
    tiers: POSITION_SWAP_FEE_TIERS,
    description: 'Position Swap Fee for Yield Loop positions across all chains and protocols',
  },
];

/**
 * Calculates the swap notional and position size for a Multiply position.
 */
export function calculateMultiplyNotional(params) {
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
 */
export function resolveSwapFeeTier(notionalUsd, tiers = POSITION_SWAP_FEE_TIERS) {
  if (notionalUsd < 0) {
    throw new Error(`Swap notional cannot be negative. Received: ${notionalUsd}`);
  }

  for (const tier of tiers) {
    if (notionalUsd >= tier.minNotionalUsd && notionalUsd < tier.maxNotionalUsd) {
      return tier;
    }
  }

  return tiers[tiers.length - 1];
}

/**
 * Calculates the exact expected position swap fee for a given notional.
 */
export function calculatePositionSwapFee(options) {
  const {
    notionalUsd,
    category = 'multiply',
    action = 'open',
    network,
    protocol,
    customRules = DEFAULT_FEE_RULES,
  } = options;

  const normalizedCategory = category === 'yield-loop' ? 'yieldLoop' : category;

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
 */
export function verifyFeeTier(params) {
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
