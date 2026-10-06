import { testWithSynpress } from '@synthetixio/synpress';
import { metaMaskFixtures } from '@synthetixio/synpress/playwright';
import baseSetup from '../../utils/synpress/wallet-setup/base.setup';
import { App } from '../app';
import { connectWallet } from '../../utils/connectWallet';
import type { FixturesNetwork } from '../../utils/types/e2e/common.js';

type TestOptions = {
  network: FixturesNetwork;
};

type TestFixtures = {
  app: App;
};

export const test = testWithSynpress(
  metaMaskFixtures(baseSetup).extend<TestFixtures & TestOptions>({
    network: ['Base', { option: true }],

    app: [
      async ({ page, metamask, network }, use) => {
        const app = new App(page);

        await app.open();

        await connectWallet({ app, metamask, network });

        await use(app);

        await app.page.close();
      },
      { timeout: 50000 },
    ],
  }),
);

export const expect = test.expect;
export { step } from './index';
export type { FixturesNetwork } from '../../utils/types/e2e/common.js';
