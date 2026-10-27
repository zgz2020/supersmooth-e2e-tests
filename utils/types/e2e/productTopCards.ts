import type { TopCardsProductType } from '../api/productTableTopCards';

export const PRODUCT_TOP_CARDS_TABS = {
  multiply: ['Most Liquidity', 'Lowest Protocol Rate', 'Highest Multiple'],
  borrow: ['Most Liquidity', 'Highest LTV', 'Lowest Protocol Rate'],
  yieldLoop: ['Most Liquidity', 'Highest APY', 'Featured'],
  earn: ['Most Liquidity', 'Highest Current APY'],
} as const satisfies Record<TopCardsProductType, readonly string[]>;

export type ProductTopCardsTabs<T extends TopCardsProductType = TopCardsProductType> =
  (typeof PRODUCT_TOP_CARDS_TABS)[T][number];
