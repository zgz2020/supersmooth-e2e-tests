import { test } from '../../../src/fixtures/anvilFork';
import { tc } from '../../../utils/testCase';

test.describe('Wallet connection @regression @fork', () => {
  test.use({ autoConnectWallet: false });

  test('should connect wallet', tc('E2E-WALLET-003'), async ({ app }) => {
    // 1. Verify initial unauthenticated state shows Connect Wallet button in header
    await app.header.shouldShowConnectWallet();

    // 2. User clicks Connect Wallet to open the wallet connector modal
    await app.header.connectWallet();
    await app.modals.connectWallet.shouldBeVisible();

    // 3. User selects MetaMask / injected provider from modal
    await app.modals.connectWallet.connectMetaMask();

    // 4. Injected mock resolves eth_requestAccounts and header displays truncated address
    await app.header.shouldHaveShortAddress();
  });
});
