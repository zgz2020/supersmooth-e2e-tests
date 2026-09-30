import { getExtensionId, MetaMask } from '@synthetixio/synpress/playwright';
import { BrowserContext, Page } from '@playwright/test';

const SEED_PHRASE = 'test test test test test test test test test test test junk';
export const PASSWORD = 'Password123';

const networkParameters = {
  arbitrum: {
    name: 'Arbitrum',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    chainId: 42161,
    symbol: 'ETH',
  },
  base: {
    name: 'Base',
    rpcUrl: 'https://mainnet.base.org',
    chainId: 8453,
    symbol: 'ETH',
  },
  optimism: {
    name: 'Optimism',
    rpcUrl: 'https://mainnet.optimism.io',
    chainId: 10,
    symbol: 'ETH',
  },
  hyperliquid: {
    name: 'HyperEVM',
    rpcUrl: 'https://rpc.hyperliquid.xyz/evm',
    chainId: 999,
    symbol: 'HYPE',
  },
} as const;

export type SupportedNetwork = keyof typeof networkParameters;

export const commonMetamaskSetup = async ({
  context,
  walletPage,
}: {
  context: BrowserContext;
  walletPage: Page;
}) => {
  const extensionId = await getExtensionId(context, 'MetaMask');
  const metamask = new MetaMask(context, walletPage, PASSWORD, extensionId);

  await metamask.importWallet(SEED_PHRASE);

  return metamask;
};

export const addNetwork = async ({
  metamask,
  network,
}: {
  metamask: MetaMask;
  network: SupportedNetwork;
}) => {
  await metamask.addNetwork(networkParameters[network]);
};
