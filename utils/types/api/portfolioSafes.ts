import type { Address, ProductTitleCase, Protocol } from './common.ts';

export type PositionRole = 'Collateral' | 'Debt' | 'Deposit';
export type PositionOperation = 'Supply' | 'Borrow' | 'Withdraw' | 'Repay' | 'Deposit';

export interface PositionToken {
  role: PositionRole;
  address: Address;
  amount?: string;
  operation: PositionOperation;
}

export interface PositionSnapshot {
  netValueUsd: number | null;
  collateralUsd: number | null;
  debtUsd: number | null;
  suppliedUsd: number | null;
}

export interface Automation {
  id: string;
  triggerType: string | null;
  enabled: boolean;
}

export interface DataQuality {
  source: string;
  historicalSnapshotsDegraded: boolean;
  pnlDegraded: boolean;
}

export interface EarnDepositFlow {
  [key: string]: unknown;
}

export interface Position {
  id: string;
  market: string;
  product: ProductTitleCase;
  protocol: Protocol;
  chainId: number;
  tokens: PositionToken[];
  isActive: boolean;
  openedAt: string;
  closedAt: string | null;
  openingSnapshot: PositionSnapshot;
  latestSnapshot: PositionSnapshot;
  earnDepositFlow: EarnDepositFlow | null;
  automations: Automation[];
  dataQuality: DataQuality;
}

export interface PortfolioSafesResponse {
  id: string;
  address: Address;
  createdAt: string;
  positions: Position[];
}
