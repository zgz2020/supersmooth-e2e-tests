import { test, expect, defaultAnvilAddress } from '../../../src/fixtures/anvilFork';
import { getActiveVault } from '../../../utils/getActiveVault';
import { anvilAccount1Address, wethMainnetAddress } from '../../../utils/constants/addresses';
import { NETWORK_CHAIN_IDS } from '../../../utils/constants/networks';
import { TIMEOUTS } from '../../../utils/constants/timeouts';
import { FORK_AMOUNTS } from '../../../utils/constants/forkAmounts';
import { knownAppBug } from '../../../src/fixtures/knownAppBug';
import { tc } from '../../../utils/testCase';

test.describe('Protocol Cases @regression @fork', () => {
  test.describe('Vault Position & Signature Flows', () => {
    test.use({ termsSigned: false });
    let targetVaultUrl: string;

    test.beforeEach(async ({ app, anvilFork }) => {
      const { url } = await getActiveVault(app.page.request, 'multiply', {
        network: 'Ethereum',
        collateral: 'ETH',
      });
      targetVaultUrl = url;

      // Seed Anvil accounts with WETH collateral for position setup
      await anvilFork.fundToken({
        tokenAddress: wethMainnetAddress,
        recipient: defaultAnvilAddress,
        amount: FORK_AMOUNTS.wethFunding,
      });
      await anvilFork.fundToken({
        tokenAddress: wethMainnetAddress,
        recipient: anvilAccount1Address,
        amount: FORK_AMOUNTS.wethFunding,
      });
    });

    test('should sign Terms of Service', tc('E2E-PROTO-001'), async ({ app }) => {
      await app.vaultPage.openPage(targetVaultUrl, { withBalance: true });

      // Enter deposit to trigger terms prompt on action
      await app.vaultPage.rightSidePanel.configurePosition.setDeposit(FORK_AMOUNTS.ethDeposit);
      await app.vaultPage.rightSidePanel.configurePosition.openPosition();

      // Terms of Service modal prompts on unapproved wallet
      await app.modals.termsOfService.shouldBeVisible({ timeout: TIMEOUTS.anvil.expect });
      // The mock wallet signs the EIP-712 terms message; the app's server must verify and store it
      await app.modals.termsOfService.acceptAndSignShouldBeStoredFor(defaultAnvilAddress);
      await app.modals.termsOfService.shouldNotBeVisible({ timeout: TIMEOUTS.anvil.expect });
    });

    test(
      'should cleanly handle user rejection, preserve form state, and keep inputs editable',
      tc('E2E-PROTO-002'),
      async ({ app, eip1193 }) => {
        // Switch to unapproved account #1
        await eip1193.switchAccount(anvilAccount1Address);

        await app.vaultPage.openPage(targetVaultUrl, { withBalance: true });

        await app.vaultPage.rightSidePanel.configurePosition.setDeposit(FORK_AMOUNTS.ethDeposit);

        // Trigger action requiring signature
        await app.vaultPage.rightSidePanel.configurePosition.openPosition();

        // Terms of Service modal prompts on unapproved wallet
        await app.modals.termsOfService.shouldBeVisible({ timeout: TIMEOUTS.anvil.expect });
        await app.modals.termsOfService.acceptTerms();

        // Configure mock provider to reject next signature with error 4001
        await eip1193.mockRejectNext(true);

        // Attempt signing; user rejection occurs in mock provider
        await app.modals.termsOfService.signAndAccept();

        // Verify modal remains open and recoverable, and dApp did not crash
        await app.modals.termsOfService.shouldBeVisible();
        await app.shouldNotShowErrorBoundary();

        // Dismiss modal and verify form state is preserved and inputs remain editable
        await app.page.keyboard.press('Escape');
        await app.vaultPage.rightSidePanel.configurePosition.shouldHaveDepositValue(
          FORK_AMOUNTS.ethDeposit,
        );
      },
    );
  });

  test.describe('Provider & Network State Flows', () => {
    test(
      'should reflect wallet network changes in the UI',
      tc('E2E-PROTO-003'),
      async ({ app, eip1193 }) => {
        await eip1193.switchChain(NETWORK_CHAIN_IDS.base);
        await app.header.openWalletFeatures();
        await app.modals.walletFeatures.shouldHaveNetworkSelected('base');

        await app.modals.walletFeatures.closeModal();

        await eip1193.switchChain(NETWORK_CHAIN_IDS.arbitrum);
        await app.header.openWalletFeatures();
        await app.modals.walletFeatures.shouldHaveNetworkSelected('arbitrum');
      },
    );

    test(
      'should switch account and keep it after a page reload',
      tc('E2E-PROTO-004'),
      async ({ app, eip1193 }) => {
        // Switch account in the mock provider to Anvil dev account #1
        await eip1193.switchAccount(anvilAccount1Address);
        await app.header.shouldShowConnectedAccount(anvilAccount1Address);

        // The app must reconnect to the wallet's current account, not the original one
        await app.reload();
        await app.header.shouldShowConnectedAccount(anvilAccount1Address);
      },
    );

    test(
      'should recover the vault page once a temporary RPC rate limit lifts',
      tc('E2E-PROTO-005'),
      async ({ app, anvilFork }) => {
        knownAppBug(
          'https://github.com/Aphelion-Co/aphelion-app/issues/1667',
          'vault page never retries after an RPC 429 (position-data chain-client has no fallback/retry)',
        );

        const { url } = await getActiveVault(app.page.request, 'multiply', {
          network: 'Ethereum',
          collateral: 'ETH',
        });

        // Every forked-chain call to the app's RPC proxy now gets the proxy's real 429 response
        const rateLimit = await anvilFork.simulateRpcRateLimit();

        // The vault page loads its data from the browser through the proxy
        await app.vaultPage.openPage(url);

        // Prove the app actually hit the rate limit, otherwise the test checks nothing
        await expect.poll(rateLimit.hits).toBeGreaterThan(0);
        await app.shouldNotShowErrorBoundary();

        // Rate limit lifts: the page must recover and show the funded balance without a reload
        await rateLimit.stop();
        await app.vaultPage.rightSidePanel.configurePosition.shouldShowPositiveDepositBalance();
      },
    );
  });
});
