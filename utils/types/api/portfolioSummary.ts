interface ChainBreakdown {
  chainId: number;
  valueUsd: number;
  sharePercent: number;
}

export interface PortfolioSummary {
  supersmoothPortfolioUsd: number;
  supersmoothPortfolioChange7d: number;
  suppliedUsd: number;
  suppliedChange7d: number;
  borrowedUsd: number;
  borrowedChange7d: number;
  borrowedChange7dUsd: number;
  chainBreakdown: ChainBreakdown[];
}
