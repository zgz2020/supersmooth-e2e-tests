import type { Address } from './common';

export interface LendingMigrationTokenAmount {
  address: Address;
  symbol: string;
  decimals: number;
  amount: string;
  usd: number | null;
}

export interface LendingMigrationProducts {
  borrow: boolean;
  multiply: boolean;
}

export interface WalletLendingMigration {
  id: string;
  chainId: number;
  protocol: string;
  marketIdentifier: string;
  positionId: string | null;
  collateral: LendingMigrationTokenAmount;
  debt: LendingMigrationTokenAmount;
  netValueUsd: number | null;
  ltv: number;
  maxLtv: number;
  maxLtvWad: string;
  liquidationPriceUsd: number;
  borrowRate: number | null;
  collateralSupplyApy: number | null;
  sourceEmode: number | null;
  products: LendingMigrationProducts;
  blockNumber: string | null;
  unsupportedReason: string | null;
}

export interface AdoptableSafeItem {
  safe: Address;
  chainId: number;
  usesDefiSaver: boolean;
  position: WalletLendingMigration;
  holdsOtherPositions: boolean;
  otherAutomations: number | null;
}

export interface MigrateAdoptableSafesResponse {
  safes: AdoptableSafeItem[];
}
