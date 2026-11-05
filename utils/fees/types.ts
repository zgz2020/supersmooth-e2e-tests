/**
 * utils/fees/types.ts
 *
 * Strongly-typed definitions for DeFi fee structures, tiered calculations,
 * and autonomous fee verification across SuperSmooth protocols and networks.
 *
 * Reference: https://supersmooth.mintlify.site/fees
 */

export type FeeType = 'position_swap' | 'origination' | 'closure' | 'rebalance';

export type PositionCategory = 'multiply' | 'yieldLoop' | 'yield-loop' | 'borrow' | 'earn';

export type PositionAction = 'open' | 'adjust' | 'close';

export type SupportedNetwork = 'Base' | 'Ethereum' | 'Arbitrum One' | 'Robinhood' | string;

export type SupportedProtocol =
  'morpho' | 'aave' | 'spark' | 'fluid' | 'euler' | 'gauntlet' | string;

export interface FeeTier {
  id: string;
  name: string;
  minNotionalUsd: number;
  maxNotionalUsd: number; // Infinity for uncapped top tier
  bps: number; // Basis points (e.g., 30 bps = 0.30%)
  rate: number; // Decimal rate (e.g., 0.0030)
  description?: string;
}

export interface FeeRule {
  feeType: FeeType;
  category: PositionCategory | 'all';
  actions: PositionAction[];
  tiers: FeeTier[];
  description: string;
  network?: SupportedNetwork;
  protocol?: SupportedProtocol;
}

export interface FeeCalculationResult {
  feeType: FeeType;
  category: PositionCategory;
  action: PositionAction;
  notionalUsd: number;
  bps: number;
  rate: number;
  expectedFeeUsd: number;
  tier: FeeTier;
  network?: SupportedNetwork;
  protocol?: SupportedProtocol;
}

export interface FeeVerificationResult {
  isValid: boolean;
  notionalUsd: number;
  expectedBps: number;
  expectedFeeUsd: number;
  actualBps?: number;
  actualFeeUsd?: number;
  deltaBps: number;
  tierMatched: FeeTier;
  reason?: string;
}

export interface MultiplyNotionalParams {
  depositAmount: number;
  depositTokenPriceUsd: number;
  multiple: number; // e.g. 2.0x, 3.5x
}

export interface MultiplyNotionalResult {
  depositUsd: number;
  multiple: number;
  totalPositionSizeUsd: number;
  borrowAmountUsd: number;
  swapNotionalUsd: number; // The amount of borrowed funds swapped to buy additional collateral
}
