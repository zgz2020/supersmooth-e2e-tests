import { MetaMask } from '@synthetixio/synpress/playwright';
import { App } from '../src/app';
import { switchNetwork } from './switchNetwork';
import type { FixturesNetwork } from './types/e2e/common';

export const connectWallet = async ({
  app,
  metamask,
  network = 'Base',
}: {
  app: App;
  metamask: MetaMask;
  network?: FixturesNetwork;
}) => {
  await app.header.connectWallet();
  await app.modals.connectWallet.shouldBeVisible();

  await app.modals.connectWallet.connectMetaMask();

  await metamask.connectToDapp();

  await app.header.shouldHaveShortAddress();

  if (network && network !== 'Ethereum') {
    await app.header.openWalletFeatures();
    await switchNetwork({ app, metamask, network });
  }
};
