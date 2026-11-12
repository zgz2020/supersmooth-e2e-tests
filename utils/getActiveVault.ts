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

  // 2. Discover from server-rendered product catalog HTML
  const productPath = productType === 'yieldLoop' ? 'yield-loop' : productType;
  const catalogPage = productType === 'yieldLoop' ? 'earn' : productType;
  const chainSegment = targetChainId ? `/${targetChainId}/` : '/\\d+/';

  try {
    const pageResponse = await request.get(`/products/${catalogPage}`);
    if (pageResponse.ok()) {
      const html = await pageResponse.text();
      const linkRegex = new RegExp(
        `href="(/products/${productPath}/[a-zA-Z0-9-]+${chainSegment}0x[a-fA-F0-9-]+)"[^>]*>([\\s\\S]*?)(?=</a>|href="/products/)`,
        'g',
      );

      let match: RegExpExecArray | null;
      while ((match = linkRegex.exec(html)) !== null) {
        const url = match[1];
        const rowSegment = match[2];
        const tokenMatch = rowSegment.match(
          /<span[^>]*class="[^"]*truncate[^"]*"[^>]*>([A-Za-z0-9]+)<\/span>/,
        );
        const token = (tokenMatch ? tokenMatch[1] : (options?.collateral ?? 'ETH')) as Token;

        if (options?.protocols) {
          const protocolList = options.protocols.toLowerCase().split(',');
          const hasProtocol = protocolList.some((p) => url.toLowerCase().includes(`/${p}/`));
          if (!hasProtocol) continue;
        }

        if (options?.collateral && !isTokenMatch(token, options.collateral)) {
          continue;
        }

        return {
          url,
          collateral: (options?.collateral ?? token) as Token,
          title: `${productType} (${token})`,
        };
      }
    }
  } catch {
    // Continue to canonical fallback
  }

  // 3. Known canonical fallback vaults on Ethereum Mainnet (chain 1) and Base (chain 8453)
  if (targetChainId === '1') {
    if (productType === 'multiply') {
      return {
        url: vaultPath('multiply', 'spark', 1, FALLBACK_MARKETS.sparkWethUsdsEthereum),
        collateral: (options?.collateral ?? 'ETH') as Token,
        title: 'Spark WETH Multiply on Ethereum',
        protocol: 'spark',
        network: 'ethereum',
      };
    }
    if (productType === 'borrow') {
      return {
        url: vaultPath('borrow', 'spark', 1, FALLBACK_MARKETS.sparkWethUsdsEthereum),
        collateral: (options?.collateral ?? 'ETH') as Token,
        title: 'Spark WETH Borrow on Ethereum',
        protocol: 'spark',
        network: 'ethereum',
      };
    }
  }

  if (targetChainId === '8453') {
    if (productType === 'multiply') {
      return {
        url: vaultPath('multiply', 'morpho', 8453, FALLBACK_MARKETS.morphoEthBase),
        collateral: (options?.collateral ?? 'ETH') as Token,
        title: 'Morpho ETH Multiply on Base',
        protocol: 'morpho',
        network: 'base',
      };
    }
    if (productType === 'borrow') {
      return {
        url: vaultPath('borrow', 'morpho', 8453, FALLBACK_MARKETS.morphoEthBase),
        collateral: (options?.collateral ?? 'ETH') as Token,
        title: 'Morpho ETH Borrow on Base',
        protocol: 'morpho',
        network: 'base',
      };
    }
    if (productType === 'yieldLoop') {
      return {
        url: '/products/yield-loop/morpho/8453/0x3a4048c64ba1b375330d376b1ce40e4047d03b47ab4d48af484edec9fec801ba',
        collateral: (options?.collateral ?? 'wstETH') as Token,
        title: 'Morpho wstETH Yield Loop on Base',
        protocol: 'morpho',
        network: 'base',
      };
    }
    if (productType === 'earn') {
      if (options?.collateral === 'USDC' || options?.protocols === 'morpho') {
        return {
          url: '/products/earn/morpho/8453/0xbeeff2490FEffa212faC2f6553682C219E6a8845',
          collateral: 'USDC',
          title: 'Morpho USDC Earn on Base',
          protocol: 'morpho',
          network: 'base',
        };
      }
      return {
        url: '/products/earn/coinbase/8453/0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22',
        collateral: (options?.collateral ?? 'cbETH') as Token,
        title: 'Coinbase cbETH Earn on Base',
        protocol: 'coinbase',
        network: 'base',
      };
    }
  }

  throw new Error(
    `No active vaults found for productType=${productType}${options?.network ? `, network=${options.network}` : ''}${options?.collateral ? `, collateral=${options.collateral}` : ''}`,
  );
}
