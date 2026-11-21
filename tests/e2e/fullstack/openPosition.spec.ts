import { test } from '../../../src/fixtures/fullStack';
import { wethMainnetAddress, wstEthMainnetAddress } from '../../../utils/constants/addresses';
import { PROTOCOLS, pickOpenableVault, type OpenPositionScenario } from '../../../utils/protocols';
import { tc } from '../../../utils/testCase';

/**
 * Each row runs the same test. To cover another protocol, network or token, add a row (and its
 * test case); a new protocol also needs an adapter in utils/protocols and its product table filled
 * by the stack. The stack forks Ethereum only for now.
 */
const SCENARIOS: OpenPositionScenario[] = [
  {
    caseId: 'E2E-PROTO-006',
    protocol: PROTOCOLS.aaveV3,
    network: { name: 'Ethereum', chainId: 1 },
    collateral: { symbol: 'WETH', address: wethMainnetAddress },
    deposit: 1,
  },
  {
    caseId: 'E2E-PROTO-008',
    protocol: PROTOCOLS.spark,
    network: { name: 'Ethereum', chainId: 1 },
    collateral: { symbol: 'WETH', address: wethMainnetAddress },
    deposit: 1,
  },
  {
    // wstETH, the market's main collateral; also covers funding a token that is not WETH
    caseId: 'E2E-PROTO-009',
    protocol: PROTOCOLS.aaveV3Lido,
    network: { name: 'Ethereum', chainId: 1 },
    collateral: { symbol: 'wstETH', address: wstEthMainnetAddress },
    deposit: 1,
  },
];

// Room each leg of the market must have, far above the deposit at the app's maximum multiple, so
// a market close to its limits is skipped rather than failing the run halfway through
const REQUIRED_MARKET_ROOM_USD = 50_000;
// On a fresh fork, reads through the app's RPC proxy can time out while Anvil fetches cold state
// upstream; the app retries them
const OPEN_TIMEOUT = 150_000;

test.describe('Open position on the full local stack @fullstack', () => {
  for (const scenario of SCENARIOS) {
    const { protocol, network, collateral, deposit } = scenario;

    test(
      `should open a Multiply position (${protocol.slug}, ${collateral.symbol}, ${network.name}) and show it on its position page and in the portfolio`,
      tc(scenario.caseId),
      async ({ app, stack, wallet, request }) => {
        const { vault, market } = await test.step('Pick a vault that can take the trade', () =>
          pickOpenableVault(request, scenario, { minRoomUsd: REQUIRED_MARKET_ROOM_USD }));

        await test.step('Open the position from the vault page', async () => {
          await wallet.fund(
            collateral.address,
            deposit,
            protocol.holderOf(market, collateral.address),
          );
          await app.vaultPage.openPage(vault.url, { withBalance: true });
          await app.vaultPage.rightSidePanel.configurePosition.setDeposit(String(deposit));
          await app.vaultPage.rightSidePanel.configurePosition.openPosition();
          await app.modals.termsOfService.acceptAndSignShouldBeStoredFor(wallet.address);
          await app.vaultPage.rightSidePanel.configurePosition.shouldShowPositionOpenedRetryingReverts(
            {
              timeout: OPEN_TIMEOUT,
            },
          );
        });

        await test.step('App database: the terms acceptance was stored', async () => {
          await stack.appDb.shouldHaveStoredTermsAcceptance(wallet.address);
        });

        await test.step('Chain and indexer: every transaction mined and indexed', async () => {
          const lastBlock = await stack.chain.shouldHaveMinedAll(wallet.sentTransactions);
          await stack.indexer.shouldReachBlock(lastBlock);
        });

        const safe = await test.step('Position page: matches the chain', async () => {
          await app.vaultPage.rightSidePanel.configurePosition.goToPosition();
          const safe = await app.positionPage.getSafeAddress();
          await stack.chain.shouldBeOwnedOnlyBy(safe, wallet.address);

          await app.positionPage.shouldLoadOpenPositionReloading();
          const position = await protocol.position(market, safe);
          await stack.chain.shouldHoldLeveragedPosition(position, deposit);
          await app.positionPage.shouldMatchPosition(position);
          return safe;
        });

        await test.step('Portfolio: shows the position as the indexer priced it', async () => {
          const indexedNetValueUsd = await stack.indexer.shouldHaveOpenSnapshot(safe);
          await app.portfolioPage.openPageShouldUseIndexer(wallet.address);
          await app.portfolioPage.shouldShowPosition(safe);
          await app.portfolioPage.shouldShowNetValue(safe, indexedNetValueUsd);
        });
      },
    );
  }
});
