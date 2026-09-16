export interface PositionToken {
  role: string;
  address: `0x${string}`;
  amount?: string;
  operation: string;
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
  product: string;
  protocol: string;
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
