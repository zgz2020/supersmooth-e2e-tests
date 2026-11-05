/**
 * tests/api/fees.spec.ts
 *
 * Automated DeFi Swap Fee Verification Suite.
 * Validates tiered swap fees for Multiply and Yield Loop positions against SuperSmooth specifications:
 * https://supersmooth.mintlify.site/fees
 *
 * Specification:
 * - Tier 1 (< $100k notional): 30 bps (0.30%)
 * - Tier 2 ($100k - $1M notional): 25 bps (0.25%)
 * - Tier 3 ($1M - $10M notional): 15 bps (0.15%)
 * - Tier 4 (> $10M notional): 5 bps (0.05%)
 */

import { expect, test, type APIRequestContext } from '@playwright/test';
import {
  calculateMultiplyNotional,
  calculatePositionSwapFee,
  DEFAULT_FEE_RULES,
  FEE_TIER_TEST_AMOUNTS,
  POSITION_SWAP_FEE_TIERS,
  resolveSwapFeeTier,
  verifyFeeTier,
} from '../../utils/fees';
import type { TokenPricesCurrentResponse } from '../../utils/types/api/tokenPricesCurrent';

async function resolveBenchmarkTokenPrice(
  request: APIRequestContext,
  address: string,
  defaultPrice = 2500,
): Promise<number> {
  try {
    const response = await request.get('/api/token-prices/current', {
      params: { coins: address },
    });
    const data: TokenPricesCurrentResponse = await response.json();
    return Number(data?.prices?.[address]) || defaultPrice;
  } catch {
    return defaultPrice;
  }
}

test.describe('DeFi Position Swap Fee Tier Engine @regression', () => {
  test('should accurately resolve fee tiers across all 4 notional brackets', () => {
    // Tier 1: Below $100k -> 30 bps
    const tier1Mid = resolveSwapFeeTier(FEE_TIER_TEST_AMOUNTS.tier1.mid);
    expect(tier1Mid.bps).toBe(30);
    expect(tier1Mid.rate).toBe(0.003);

    // Tier 2: $100k - $1M -> 25 bps
    const tier2Mid = resolveSwapFeeTier(FEE_TIER_TEST_AMOUNTS.tier2.mid);
    expect(tier2Mid.bps).toBe(25);
    expect(tier2Mid.rate).toBe(0.0025);

    // Tier 3: $1M - $10M -> 15 bps
    const tier3Mid = resolveSwapFeeTier(FEE_TIER_TEST_AMOUNTS.tier3.mid);
    expect(tier3Mid.bps).toBe(15);
    expect(tier3Mid.rate).toBe(0.0015);

    // Tier 4: Above $10M -> 5 bps
    const tier4Mid = resolveSwapFeeTier(FEE_TIER_TEST_AMOUNTS.tier4.mid);
    expect(tier4Mid.bps).toBe(5);
    expect(tier4Mid.rate).toBe(0.0005);
  });

  test('should enforce strict mathematical boundary conditions between tiers', () => {
    // Boundary Tier 1 -> Tier 2 ($100,000 threshold)
    const justBelow100k = resolveSwapFeeTier(99_999.99);
    const exactly100k = resolveSwapFeeTier(100_000.0);
    expect(justBelow100k.bps).toBe(30);
    expect(exactly100k.bps).toBe(25);

    // Boundary Tier 2 -> Tier 3 ($1,000,000 threshold)
    const justBelow1M = resolveSwapFeeTier(999_999.99);
    const exactly1M = resolveSwapFeeTier(1_000_000.0);
    expect(justBelow1M.bps).toBe(25);
    expect(exactly1M.bps).toBe(15);

    // Boundary Tier 3 -> Tier 4 ($10,000,000 threshold)
    const justBelow10M = resolveSwapFeeTier(9_999_999.99);
    const exactly10M = resolveSwapFeeTier(10_000_000.0);
    expect(justBelow10M.bps).toBe(15);
    expect(exactly10M.bps).toBe(5);
  });

  test('should derive correct Multiply swap notional from deposit and leverage multiple', () => {
    // 10 ETH @ $2,500 = $25,000 deposit with 3.0x multiple
    // Total Position = $75,000, Borrow = $50,000, Swap Notional = $50,000
    const notional = calculateMultiplyNotional({
      depositAmount: 10,
      depositTokenPriceUsd: 2500,
      multiple: 3.0,
    });

    expect(notional.depositUsd).toBe(25_000);
    expect(notional.totalPositionSizeUsd).toBe(75_000);
    expect(notional.borrowAmountUsd).toBe(50_000);
    expect(notional.swapNotionalUsd).toBe(50_000);

    const fee = calculatePositionSwapFee({
      notionalUsd: notional.swapNotionalUsd,
      category: 'multiply',
    });

    expect(fee.bps).toBe(30);
    expect(fee.expectedFeeUsd).toBe(150); // $50,000 * 0.0030 = $150
  });

  test('should calculate correct swap fees for institutional and whale Multiply sizes', () => {
    // Institutional Tier 2 ($250,000 swap notional)
    const tier2Calc = calculatePositionSwapFee({ notionalUsd: 250_000 });
    expect(tier2Calc.bps).toBe(25);
    expect(tier2Calc.expectedFeeUsd).toBe(625); // $250,000 * 0.0025 = $625

    // Whale Tier 3 ($2,500,000 swap notional)
    const tier3Calc = calculatePositionSwapFee({ notionalUsd: 2_500_000 });
    expect(tier3Calc.bps).toBe(15);
    expect(tier3Calc.expectedFeeUsd).toBe(3750); // $2,500,000 * 0.0015 = $3,750

    // Mega-Whale Tier 4 ($15,000,000 swap notional)
    const tier4Calc = calculatePositionSwapFee({ notionalUsd: 15_000_000 });
    expect(tier4Calc.bps).toBe(5);
    expect(tier4Calc.expectedFeeUsd).toBe(7500); // $15,000,000 * 0.0005 = $7,500
  });

  test('should verify compliance and flag violations with precision tolerances', () => {
    // Compliant quote: $500k notional charged 25 bps ($1,250 fee)
    const compliant = verifyFeeTier({
      notionalUsd: 500_000,
      actualFeeUsd: 1250,
    });
    expect(compliant.isValid).toBe(true);
    expect(compliant.deltaBps).toBe(0);

    // Non-compliant quote: $500k notional improperly charged 30 bps ($1,500 fee)
    const nonCompliant = verifyFeeTier({
      notionalUsd: 500_000,
      actualFeeUsd: 1500,
    });
    expect(nonCompliant.isValid).toBe(false);
    expect(nonCompliant.actualBps).toBe(30);
    expect(nonCompliant.deltaBps).toBe(5);
  });

  test('should integrate live token prices to evaluate dynamic swap fee tiers', async ({
    request,
  }) => {
    const wethAddress = 'ethereum:0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
    const ethPrice = await resolveBenchmarkTokenPrice(request, wethAddress, 2500);

    // Dynamic test: 50 ETH deposit at 4.0x leverage (borrow = 3x deposit = 150 ETH swap)
    const notional = calculateMultiplyNotional({
      depositAmount: 50,
      depositTokenPriceUsd: ethPrice,
      multiple: 4.0,
    });

    const fee = calculatePositionSwapFee({
      notionalUsd: notional.swapNotionalUsd,
      category: 'multiply',
    });

    // If 150 ETH @ ~$2,500 = ~$375k -> Tier 2 (25 bps)
    const expectedTier = resolveSwapFeeTier(notional.swapNotionalUsd);
    expect(fee.bps).toBe(expectedTier.bps);
    expect(fee.expectedFeeUsd).toBeCloseTo(notional.swapNotionalUsd * expectedTier.rate, 2);
  });

  test('should validate protocol and network extensibility in fee rules', () => {
    expect(DEFAULT_FEE_RULES.length).toBeGreaterThanOrEqual(2);
    expect(POSITION_SWAP_FEE_TIERS).toHaveLength(4);

    // Validates that Yield Loop positions inherit position swap fee tiers
    const yieldLoopFee = calculatePositionSwapFee({
      notionalUsd: 500_000,
      category: 'yieldLoop',
    });
    expect(yieldLoopFee.bps).toBe(25);
    expect(yieldLoopFee.category).toBe('yieldLoop');
  });
});
