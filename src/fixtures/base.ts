import { testWithSynpress } from '@synthetixio/synpress';
import { metaMaskFixtures } from '@synthetixio/synpress/playwright';
import baseSetup from '../../utils/synpress/wallet-setup/base.setup';
import { App } from '../app';

export const test = testWithSynpress(
  metaMaskFixtures(baseSetup).extend<{
    app: App;
  }>({
    app: [
      async ({ page }, use) => {
        const app = new App(page);

        await app.page.goto('/');

        await use(app);

        await app.page.close();
      },
      { timeout: 50000 },
    ],
  }),
);

export const expect = test.expect;
export { step } from './index';
