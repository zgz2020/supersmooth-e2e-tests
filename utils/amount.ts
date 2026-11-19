import { expect, type Locator } from '@playwright/test';

/**
 * Reads the number out of a formatted amount shown in the UI, e.g. `$1,250.33` → 1250.33,
 * `0.0007 WETH` → 0.0007. Returns NaN when the text has no number (e.g. while loading).
 */
export const parseAmount = (text: string): number => {
  const match = text.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : NaN;
};

/** An expected amount, matched within `tolerance` (values drift with interest, prices, quotes). */
export type ApproxAmount = { value: number; tolerance: number };

/** Builds an `ApproxAmount` with a relative tolerance and an absolute floor (display rounding). */
export const approx = (
  value: number,
  { relative = 0, min = 0 }: { relative?: number; min?: number },
): ApproxAmount => ({ value, tolerance: Math.max(min, Math.abs(value) * relative) });

/** Retries until the amount shown in `locator` is within tolerance (it may still be loading). */
export const expectAmount = async (
  locator: Locator,
  { value, tolerance }: ApproxAmount,
  label: string,
) => {
  await expect
    .poll(async () => Math.abs(parseAmount(await locator.innerText()) - value), {
      message: `${label} should be ${value} (±${tolerance})`,
    })
    .toBeLessThanOrEqual(tolerance);
};
