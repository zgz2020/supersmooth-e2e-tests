import type { Address } from 'viem';
import type { Token } from '../types/e2e/common';

/** One asset of a lending market, as the protocol prices it. */
export type MarketAsset = {
  asset: Address;
  decimals: number;
  /** The protocol's own oracle price, in USD */
  priceUsd: number;
};

/** A collateral/debt market a Multiply (or Borrow) vault trades on. */
export type LendingMarket = {
  url: string;
  collateral: MarketAsset;
  debt: MarketAsset;
};

/** A Safe's position in a market, in whole tokens; the debt also in USD at the protocol's price. */
export type Position = { collateral: number; debt: number; debtUsd: number };

/**
 * Everything the full-stack tests need to know about one lending protocol on chain. Adding a
 * protocol to the suite means implementing this once (see `aaveV3Family.ts`) and registering it
 * in `index.ts`; the spec itself does not change.
 */
export interface ProtocolAdapter<M extends LendingMarket = LendingMarket> {
  /** The app's protocol slug, as in vault URLs and the product table (`aaveV3`, `spark`, …) */
  slug: string;
  /** The market behind a vault URL, read from the chain */
  market(url: string): Promise<M>;
  /**
   * Why the market cannot take a new position of `positionUsd` on each leg right now (inactive,
   * frozen or paused reserves, missing liquidity, caps), or an empty list when it can
   */
  problems(market: M, positionUsd: number): Promise<string[]>;
  /** The position `safe` holds in the market */
  position(market: M, safe: Address): Promise<Position>;
  /** An account on chain that holds plenty of `asset`, to fund test wallets from */
  holderOf(market: M, asset: Address): Address;
}

/** One combination the open-position test runs for. */
export type OpenPositionScenario = {
  /** Test case ID in test-cases/ */
  caseId: string;
  protocol: ProtocolAdapter;
  network: { name: string; chainId: number };
  collateral: { symbol: Token; address: Address };
  /** Amount deposited, in collateral tokens */
  deposit: number;
};
