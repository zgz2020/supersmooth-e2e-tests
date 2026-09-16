export type PositionRole = 'Collateral' | 'Debt';
export type PositionOperation = 'Supply' | 'Borrow' | 'Withdraw' | 'Repay';
export type PositionProduct = 'Multiply' | 'Borrow' | 'Earn';
export type PositionProtocol = 'morpho' | 'euler' | 'compoundV3' | 'aaveV3';

export interface PositionToken {
  role: PositionRole;
  address: `0x${string}`;
  amount?: string;
  operation: PositionOperation;
}

export interface PositionSnapshot {
  netValueUsd: number;
  collateralUsd: number;
  debtUsd: number;
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
  product: PositionProduct;
  protocol: PositionProtocol;
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

export interface PortfolioSafe {
  id: string;
  address: `0x${string}`;
  createdAt: string;
  positions: Position[];
}
