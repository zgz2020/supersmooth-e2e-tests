import { MetaMask } from '@synthetixio/synpress/playwright';
import { App } from '../src/app.ts';
import { expect } from '../src/fixtures/base.ts';
import { defaultExpectTimeout } from './constants/timeouts.ts';
import type { FixturesNetwork } from './types/e2e/common.ts';

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

  await expect(async () => await metamask.approveNewNetwork()).toPass({
    timeout: defaultExpectTimeout * 3,
  });
  await metamask.approveSwitchNetwork();
  await app.modals.walletFeatures.chooseNetwork.closeModal();
};
