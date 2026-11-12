import type { APIRequestContext } from '@playwright/test';
import type {
  ProductTableTopCardsResponse,
  TopCardsProductType,
} from './types/api/productTableTopCards';
import type { Token } from './types/e2e/common';
import { FALLBACK_MARKETS, vaultPath } from './constants/urls';

export interface ActiveVaultResult {
  url: string;
  collateral: Token;
  title: string;
  protocol?: string;
  network?: string;
}

export interface GetActiveVaultOptions {
  filterId?: string;
  protocols?: string;
  network?: 'Base' | 'Ethereum' | 'Arbitrum One' | string | number;
  collateral?: Token;
}

const NETWORK_CHAIN_IDS: Record<string, string> = {
  ethereum: '1',
  '1': '1',
  base: '8453',
  '8453': '8453',
  arbitrum: '42161',
  'arbitrum one': '42161',
  '42161': '42161',
};

/**
 * Checks if a candidate token matches the requested collateral token.
 * Note: 'WETH' and 'ETH' are treated as interchangeable for deposit selectors.
 * Comparisons are normalized to uppercase for case-insensitivity.
 */
function isTokenMatch(candidate: string, target?: Token): boolean {
  if (!target) return true;
  const c = candidate.toUpperCase();
  const t = target.toUpperCase();
  if (c === t) return true;
  if ((t === 'ETH' && c === 'WETH') || (t === 'WETH' && c === 'ETH')) {
    return true;
  }
  return false;
}

/**
 * Dynamically resolves an active vault URL and collateral token.
 * Queries /api/product-table/top-cards, and falls back to server-rendered product hub tables
 * if network-specific or collateral-specific vaults are requested.
 *
 * This prevents E2E test failures caused by deprecated, paused, or delisted hardcoded vaults.
 */
export async function getActiveVault(
  request: APIRequestContext,
  productType: TopCardsProductType,
  options?: GetActiveVaultOptions,
): Promise<ActiveVaultResult> {
  const filterId = options?.filterId ?? 'most-liquidity';
  const protocols =
    options?.protocols ??
    (productType === 'yieldLoop' && !options?.network ? 'spark,fluid' : undefined);
  const targetChainId = options?.network
    ? NETWORK_CHAIN_IDS[String(options.network).toLowerCase()]
    : undefined;
  const targetNetworkName = options?.network ? String(options.network).toLowerCase() : undefined;

  // 1. Query /api/product-table/top-cards API
  try {
    const response = await request.get('/api/product-table/top-cards', {
      params: {
        productType,
        filterId,
        ...(protocols ? { protocols } : {}),
      },
    });

    if (response.ok()) {
      const data: ProductTableTopCardsResponse = await response.json();
      if (data.cards && data.cards.length > 0) {
        // Filter by network and collateral if specified.
        // For multiply, borrow, yield loop, and earn, tokens[0] is the deposited collateral asset.
        const matchingCard = data.cards.find((c) => {
          if (targetChainId && !c.url.includes(`/${targetChainId}/`)) {
            if (c.network?.toLowerCase() !== targetNetworkName) return false;
          }
          if (options?.collateral) {
            const depositToken = c.tokens[0];
            if (!isTokenMatch(depositToken, options.collateral)) return false;
          }
          return true;
        });

        if (matchingCard) {
          const matchedToken = matchingCard.tokens[0];
          return {
            url: matchingCard.url,
            collateral: (options?.collateral ?? matchedToken) as Token,
            title: matchingCard.title,
            protocol: matchingCard.protocol,
            network: matchingCard.network,
          };
        }

        // If no network/collateral filter was requested, return first card
        if (!options?.network && !options?.collateral) {
          const topCard = data.cards[0];
          return {
            url: topCard.url,
            collateral: topCard.tokens[0] as Token,
            title: topCard.title,
            protocol: topCard.protocol,
            network: topCard.network,
          };
        }
      }
    }
  } catch {
    // Continue to HTML / canonical fallback
  }

  // 2. Product catalog filtered server-side by the app, with each candidate's real collateral
  //    confirmed through /api/product-detail. Only multiply/borrow can be confirmed that way, so
  //    earn/yield loop go straight to the canonical fallbacks instead of guessing.
  if (isVerifiableProductType(productType)) {
    try {
      const verified = await findVerifiedCatalogVault(request, productType, {
        chainId: targetChainId,
        collateral: options?.collateral,
        protocols: options?.protocols,
      });
      if (verified) return verified;
    } catch {
      // Continue to canonical fallback
    }
  }

  // 3. Known canonical fallback vaults, returned only when their real collateral matches
  const fallback = FALLBACK_VAULTS.find(
    (vault) =>
      vault.chainId === targetChainId &&
      vault.productType === productType &&
      isTokenMatch(vault.collateral, options?.collateral) &&
      isProtocolMatch(vault.protocol, options?.protocols),
  );
  if (fallback) {
    const { chainId: _chainId, productType: _productType, ...vault } = fallback;
    return { ...vault, collateral: (options?.collateral ?? vault.collateral) as Token };
  }

  throw new Error(
    `No active vaults found for productType=${productType}${options?.network ? `, network=${options.network}` : ''}${options?.collateral ? `, collateral=${options.collateral}` : ''}`,
  );
}

// -----------------------------------------------------------------------------
// Step 2 helpers: catalog candidates + collateral verification
// -----------------------------------------------------------------------------
type VerifiableProductType = Extract<TopCardsProductType, 'multiply' | 'borrow'>;

const isVerifiableProductType = (type: TopCardsProductType): type is VerifiableProductType =>
  type === 'multiply' || type === 'borrow';

/** Products page `?network=` filter ids, keyed by chain id */
const NETWORK_FILTER_IDS: Record<string, string> = {
  '1': 'ethereum',
  '8453': 'base',
  '42161': 'arbitrum',
};

/** Max candidates checked against /api/product-detail before giving up */
const MAX_VERIFIED_CANDIDATES = 10;

function isProtocolMatch(protocol: string | undefined, protocols?: string): boolean {
  if (!protocols) return true;
  const wanted = protocols.toLowerCase().split(',');
  return !!protocol && wanted.includes(protocol.toLowerCase());
}

interface ProductDetailResponse {
  product: { collateral_token?: string; debt_token?: string } | null;
  isExactMatch?: boolean;
}

/**
 * Lists vault URLs from the products page (using the app's own `network`/`deposit` filters to
 * narrow them down), then returns the first one whose collateral `/api/product-detail` confirms.
 *
 * Never trusts the page markup for the collateral: top-card links are mixed in with table rows,
 * and the `deposit` filter also keeps vaults that merely accept the token via a swap
 * (e.g. `deposit=ETH` keeps wstETH and cbETH vaults).
 */
async function findVerifiedCatalogVault(
  request: APIRequestContext,
  productType: VerifiableProductType,
  filters: { chainId?: string; collateral?: Token; protocols?: string },
): Promise<ActiveVaultResult | undefined> {
  const params = new URLSearchParams();
  const networkFilter = filters.chainId ? NETWORK_FILTER_IDS[filters.chainId] : undefined;
  if (networkFilter) params.set('network', networkFilter);
  if (filters.collateral) params.set('deposit', filters.collateral);

  const pageResponse = await request.get(`/products/${productType}?${params.toString()}`);
  if (!pageResponse.ok()) return undefined;

  const html = await pageResponse.text();
  const candidates = new Map<string, { protocol: string; chainId: string; marketId: string }>();
  const linkRegex = new RegExp(
    `/products/${productType}/([a-z0-9-]+)/(\\d+)/(0x[a-fA-F0-9-]+)`,
    'g',
  );
  for (const [url, protocol, chainId, marketId] of html.matchAll(linkRegex)) {
    if (filters.chainId && chainId !== filters.chainId) continue;
    if (!isProtocolMatch(protocol, filters.protocols)) continue;
    if (!candidates.has(url)) candidates.set(url, { protocol, chainId, marketId });
  }

  for (const [url, { protocol, chainId, marketId }] of [...candidates].slice(
    0,
    MAX_VERIFIED_CANDIDATES,
  )) {
    const detailResponse = await request.get('/api/product-detail', {
      params: { protocol, chainId, marketIdentifier: marketId, productType },
    });
    if (!detailResponse.ok()) continue;

    const { product, isExactMatch }: ProductDetailResponse = await detailResponse.json();
    const collateral = product?.collateral_token;
    if (!isExactMatch || !collateral || !isTokenMatch(collateral, filters.collateral)) continue;

    return {
      url,
      collateral: (filters.collateral ?? collateral) as Token,
      title: `${collateral}/${product?.debt_token ?? '?'} ${productType}`,
      protocol,
      network: networkFilter,
    };
  }

  return undefined;
}

// -----------------------------------------------------------------------------
// Step 3: canonical fallback vaults, each with its REAL collateral
// -----------------------------------------------------------------------------
interface FallbackVault extends ActiveVaultResult {
  chainId: string;
  productType: TopCardsProductType;
}

const FALLBACK_VAULTS: FallbackVault[] = [
  {
    chainId: '1',
    productType: 'multiply',
    url: vaultPath('multiply', 'spark', 1, FALLBACK_MARKETS.sparkWethUsdsEthereum),
    collateral: 'WETH',
    title: 'Spark WETH Multiply on Ethereum',
    protocol: 'spark',
    network: 'ethereum',
  },
  {
    chainId: '1',
    productType: 'borrow',
    url: vaultPath('borrow', 'spark', 1, FALLBACK_MARKETS.sparkWethUsdsEthereum),
    collateral: 'WETH',
    title: 'Spark WETH Borrow on Ethereum',
    protocol: 'spark',
    network: 'ethereum',
  },
  {
    chainId: '8453',
    productType: 'multiply',
    url: vaultPath('multiply', 'morpho', 8453, FALLBACK_MARKETS.morphoEthBase),
    collateral: 'WETH',
    title: 'Morpho WETH Multiply on Base',
    protocol: 'morpho',
    network: 'base',
  },
  {
    chainId: '8453',
    productType: 'borrow',
    url: vaultPath('borrow', 'morpho', 8453, FALLBACK_MARKETS.morphoEthBase),
    collateral: 'WETH',
    title: 'Morpho WETH Borrow on Base',
    protocol: 'morpho',
    network: 'base',
  },
  {
    chainId: '8453',
    productType: 'yieldLoop',
    url: '/products/yield-loop/morpho/8453/0x3a4048c64ba1b375330d376b1ce40e4047d03b47ab4d48af484edec9fec801ba',
    collateral: 'wstETH',
    title: 'Morpho wstETH Yield Loop on Base',
    protocol: 'morpho',
    network: 'base',
  },
  {
    chainId: '8453',
    productType: 'earn',
    url: '/products/earn/coinbase/8453/0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22',
    collateral: 'cbETH',
    title: 'Coinbase cbETH Earn on Base',
    protocol: 'coinbase',
    network: 'base',
  },
  {
    chainId: '8453',
    productType: 'earn',
    url: '/products/earn/morpho/8453/0xbeeff2490FEffa212faC2f6553682C219E6a8845',
    collateral: 'USDC',
    title: 'Morpho USDC Earn on Base',
    protocol: 'morpho',
    network: 'base',
  },
];
