import type { ProductType } from './common.ts';

export type EffectiveSpreadProduct = Exclude<ProductType, 'earn'> | 'yieldLoop';

export interface EffectiveSpreadResponse {
  spreadBps: number | null;
}
