import { expect } from '@playwright/test';
import { MetaMask } from '@synthetixio/synpress/playwright';
import { App } from '../src/app';
import { defaultExpectTimeout } from './constants/timeouts';
import type { FixturesNetwork } from './types/e2e/common';

export const switchNetwork = async ({
  app,
  metamask,
  network,
}: {
  app: App;
  metamask: MetaMask;
  network: FixturesNetwork;
}) => {
  await app.modals.walletFeatures.openNetworkSelector();
  await app.modals.walletFeatures.chooseNetwork.shouldBeVisible();
  await app.modals.walletFeatures.chooseNetwork.switchNetwork(network);

  if (network !== 'Ethereum') {
    await expect(async () => await metamask.approveNewNetwork()).toPass({
      timeout: defaultExpectTimeout * 3,
    });
  }
  await metamask.approveSwitchNetwork();
  await app.modals.walletFeatures.chooseNetwork.closeModal();
};
