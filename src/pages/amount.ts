/**
 * Reads the number out of a formatted amount shown in the UI, e.g. `$1,250.33` → 1250.33,
 * `0.0007 WETH` → 0.0007. Returns NaN when the text has no number (e.g. while loading).
 */
export const parseAmount = (text: string): number => {
  const match = text.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : NaN;
};
