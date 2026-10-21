import type { ProductType } from './common';

export type EffectiveSpreadProduct = Exclude<ProductType, 'earn'> | 'yieldLoop';

export interface EffectiveSpreadResponse {
  spreadBps: number | null;
}
