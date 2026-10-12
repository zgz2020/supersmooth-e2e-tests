export interface ProductTableTopCard {
  id: string;
  title: string;
  tokens: string[];
  network?: string;
  protocol?: string;
  oracle?: string;
  automations: Record<string, unknown>;
  marketedLabel: string;
  marketedValue: string;
  marketedSubValue?: number;
  tvl?: string;
  footerLabel?: string;
  maxDeposit?: string;
  maxDepositSubValue?: string;
  url: string;
}

export interface ProductTableTopCardsResponse {
  cards: ProductTableTopCard[];
}

export type TopCardsProductType = 'multiply' | 'borrow' | 'earn' | 'yieldLoop';
