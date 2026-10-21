import type { Address } from './common.ts';

export interface MigrationItem {
  id: string;
  chainId: number;
  protocol: string;
  marketIdentifier: string;
  name: string | null;
  curator: string | null;
  depositToken: string;
  assetAddress: Address;
  assetDecimals: number;
  sourceKind: string;
  receiptToken: Address;
  receiptSymbol: string;
  receiptDecimals: number;
  receiptBalance: string;
  depositAmount: string;
  apy: number;
  liquidity: number;
  unsupportedReason: string | null;
  depositUsd: number;
}

export interface MigrateEarnPositionsResponse {
  migrations: MigrationItem[];
  unscannedChainIds: number[];
}
