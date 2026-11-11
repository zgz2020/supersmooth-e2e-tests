/**
 * Centralized URL constants and normalization utilities.
 */

export const DEFAULT_BASE_URL = 'https://staging.supersmooth.fi';

/**
 * Normalizes a base URL by removing any trailing slashes and providing a default fallback.
 *
 * @param url Optional URL string to normalize.
 * @param fallback Optional fallback URL if `url` is not provided or empty (defaults to DEFAULT_BASE_URL).
 * @returns Clean normalized URL without trailing slashes.
 */
export function normalizeBaseUrl(url?: string, fallback: string = DEFAULT_BASE_URL): string {
  const base = (url || '').trim() || fallback;
  return base.replace(/\/+$/, '');
}

/** Canonical markets used as fallbacks when the vault API cannot provide an active vault. */
export const FALLBACK_MARKETS = {
  /** Spark WETH/USDS on Ethereum Mainnet (chain 1) */
  sparkWethUsdsEthereum:
    '0xC13e21B648A5Ee794902342038FF3aDAB66BE987-0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2-0xdC035D45d973E3EC169d2276DDab16f1e407384F',
  /** Morpho ETH market on Base (chain 8453) */
  morphoEthBase: '0x8793cf302b8ffd655ab97bd1c695dbd967807e8367a65cb2f4edaf1380ba1bda',
} as const;

/** Builds an app vault path, e.g. `/products/multiply/spark/1/<marketId>`. */
export const vaultPath = (
  product: 'multiply' | 'borrow' | 'yield-loop',
  protocol: string,
  chainId: number,
  marketId: string,
): string => `/products/${product}/${protocol}/${chainId}/${marketId}`;
