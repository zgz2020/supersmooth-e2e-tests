import { test } from '../../../src/fixtures/base';

test.describe('Connect wallet', () => {
  test.beforeEach(async ({}, testInfo) => {
    testInfo.setTimeout(testInfo.timeout + 25_000);
  });

  test('It should connect MetaMask wallet', async ({ app, metamask }) => {
    await app.header.connectWallet();
    await app.modals.connectWallet.shouldBeVisible();

    await app.modals.connectWallet.connectMetaMask();

    await metamask.connectToDapp();

    await app.header.shouldHaveShortAddress('0x5d3C...4074');
  });
});
