import type { Address } from './types/api/common';

/** Placeholders some apps use for the native token: never contracts, so never checked. */
const NOT_CONTRACTS = new Set([
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  '0x0000000000000000000000000000000000000000',
]);

/**
 * Protocols (URL slug, lowercase) whose markets are reserves of a shared pool: Aave V3 and its
 * forks. Their pools answer `getReservesList()` with every listed token.
 */
const POOL_RESERVE_PROTOCOLS = new Set(['aavev3', 'aavev3lido', 'spark']);

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

function pathSegments(url: string): string[] {
  const path = url.split(/[?#]/)[0].replace(/\/+$/, '');
  return path.split('/').filter(Boolean);
}

/**
 * The contract addresses a vault page URL names, in its last path segment: the pool, collateral
 * and debt token for a lending market (`<pool>-<collateral>-<debt>`), or the vault for Earn.
 * Ids that aren't addresses (a Morpho market id is 32 bytes) and native-token placeholders are
 * left out, so a URL with nothing to check returns [].
 */
export function vaultContractAddresses(url: string): Address[] {
  const marketId = pathSegments(url).at(-1) ?? '';
  return marketId
    .split('-')
    .filter((part) => ADDRESS.test(part) && !NOT_CONTRACTS.has(part.toLowerCase()))
    .map((part) => part as Address);
}

/**
 * For a market that is a reserve pair of a shared pool (Aave V3 and its forks), the pool and the
 * two tokens that must be listed on it; null for any other vault. A market added to an existing
 * pool uses contracts that already had code, so only the pool's reserve list tells whether the
 * market existed at a given block.
 */
export function poolReserveMarket(url: string): { pool: Address; tokens: Address[] } | null {
  const segments = pathSegments(url);
  const products = segments.indexOf('products');
  const protocol = products >= 0 ? segments[products + 2]?.toLowerCase() : undefined;
  if (!protocol || !POOL_RESERVE_PROTOCOLS.has(protocol)) return null;

  const parts = (segments.at(-1) ?? '').split('-');
  if (parts.length !== 3 || !parts.every((part) => ADDRESS.test(part))) return null;
  const [pool, collateral, debt] = parts as Address[];
  return { pool, tokens: [collateral, debt] };
}
