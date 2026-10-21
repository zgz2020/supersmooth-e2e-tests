import type { Network, Oracle, ProductType, Protocol } from './common.ts';

export interface RecommendedStrategyCard {
  id: string;
  title: string;
  tokens: string[];
  network: Network;
  protocol: Protocol;
  oracle: Oracle;
  automations: Record<string, unknown>;
  tvl: string;
  marketedLabel: string;
  marketedValue: string;
  url: string;
  productType: ProductType;
}

export interface PortfolioRecommendedStrategies {
  cards: RecommendedStrategyCard[];
}
