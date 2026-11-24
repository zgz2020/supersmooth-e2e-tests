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

/**
 * GraphQL endpoint of the Ponder indexer behind the app under test (read-only, no auth). Staging
 * and production each have their own indexer, so the URL is picked from the app's host:
 * `INDEXER_URL_STAGING` for `staging.*`, `INDEXER_URL_PRODUCTION` otherwise. `INDEXER_URL`, when
 * set, overrides both (e.g. a local indexer). URLs are kept out of tracked files on purpose, and
 * errors name the variable, never its value; see `.env.example`.
 */
export function indexerGraphqlUrl(
  appBaseUrl: string = normalizeBaseUrl(process.env.BASE_URL),
  env: NodeJS.ProcessEnv = process.env,
): string {
  const variable = indexerUrlVariable(appBaseUrl, env);
  const indexer = env[variable]?.trim();
  if (!indexer) {
    throw new Error(
      `${variable} is not set: tests that list open positions need the indexer of ${appBaseUrl} ` +
        '(see .env.example)',
    );
  }
  return `${normalizeBaseUrl(indexer)}/graphql`;
}

/** The env variable that holds the indexer URL for `appBaseUrl`, to name it in errors. */
export function indexerUrlVariable(
  appBaseUrl: string = normalizeBaseUrl(process.env.BASE_URL),
  env: NodeJS.ProcessEnv = process.env,
): 'INDEXER_URL' | 'INDEXER_URL_STAGING' | 'INDEXER_URL_PRODUCTION' {
  if (env.INDEXER_URL?.trim()) return 'INDEXER_URL';
  return new URL(appBaseUrl).hostname.startsWith('staging.')
    ? 'INDEXER_URL_STAGING'
    : 'INDEXER_URL_PRODUCTION';
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
