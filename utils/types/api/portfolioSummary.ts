interface ChainBreakdown {
  chainId: number;
  valueUsd: number;
  sharePercent: number;
}

export interface PortfolioSummary {
  supersmoothPortfolioUsd: number;
  supersmoothPortfolioChange7d: number | null;
  suppliedUsd: number;
  suppliedChange7d: number | null;
  borrowedUsd: number;
  borrowedChange7d: number | null;
  borrowedChange7dUsd: number;
  chainBreakdown: ChainBreakdown[];
}
