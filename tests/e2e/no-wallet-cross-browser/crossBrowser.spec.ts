import { test, expect } from '../../../src/fixtures';
import { tc } from '../../../utils/testCase';

test.describe('Cross-browser smoke tests @cross-browser', () => {
  test(
    'it should load Landing page and verify hero and self-custodial section',
    tc('E2E-XB-001'),
    async ({ app }) => {
      await app.landingPage.open();
      await app.landingPage.shouldBeOpened();
      await app.header.shouldBeVisible();
      await expect(
        app.page.getByRole('heading', { name: '100% Self-Custodial, powered by Safe' }),
      ).toBeVisible();
    },
  );

  test(
    'it should load Multiply page and navigate back to Landing page via logo',
    tc('E2E-XB-002'),
    async ({ app }) => {
      await app.multiply.open();
      await app.multiply.shouldBeOpened();
      await app.header.clickOnSupersmoothLogo();
      await app.landingPage.shouldBeOpened();
    },
  );

  test(
    'it should open Connect Wallet modal and display wallet connector options',
    tc('E2E-XB-003'),
    async ({ app }) => {
      await app.multiply.open();
      await app.multiply.shouldBeOpened();
      await app.header.connectWallet();
      await app.modals.connectWallet.shouldBeVisible();
      await expect(app.page.getByRole('button', { name: 'MetaMask' })).toBeVisible();
    },
  );
});
