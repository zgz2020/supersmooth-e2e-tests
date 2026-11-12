import { test } from '../../../src/fixtures';
import { tc } from '../../../utils/testCase';

test.describe('Connect wallet - Header', () => {
  test.beforeEach(async ({ app }) => {
    await app.header.connectWallet();
    await app.modals.connectWallet.shouldBeVisible();
  });

  test(
    'it should list available wallets when clicking on wallet connector',
    tc('E2E-WALLET-001'),
    async ({ app }) => {
      await app.modals.connectWallet.shouldListWallets([
        'WalletConnect',
        'My Wallet',
        'Trust Wallet',
        'MetaMask',
        'Binance Wallet',
      ]);
    },
  );

  test(
    'it should allow user to search for a wallet @regression',
    tc('E2E-WALLET-002'),
    async ({ app }) => {
      await app.modals.connectWallet.openSearch();

      await app.modals.connectWallet.allWallets.shouldBeVisible();
      await app.modals.connectWallet.allWallets.shouldListWallets([
        'My Wallet',
        'Trust Wallet',
        'MetaMask',
        'Binance Wallet',
      ]);
      await app.modals.connectWallet.allWallets.shouldNotListWallets([
        'Kriptomat',
        'Kriptonio',
        'KriptoK',
      ]);

      await app.modals.connectWallet.allWallets.search('Kripto');
      await app.modals.connectWallet.allWallets.shouldListWallets([
        'Kriptomat',
        'Kriptonio',
        'KriptoK',
      ]);
      await app.modals.connectWallet.allWallets.shouldNotListWallets([
        'My Wallet',
        'Trust Wallet',
        'MetaMask',
        'Binance Wallet',
      ]);
    },
  );
});
