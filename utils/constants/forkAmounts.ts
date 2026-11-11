/**
 * Amounts for Anvil fork tests (`tests/e2e/anvil`).
 *
 * Fork wallets are pre-funded (1,000 ETH, plus WETH minted in setup), so fork tests use realistic
 * position sizes worth 10-100 ETH. With-wallet tests on staging spend real funds and keep tiny
 * amounts instead (see `DEFAULT_DEPOSIT_AMOUNT` in utils/verifyTermsAndAcceptIfNeeded.ts).
 */
export const FORK_AMOUNTS = {
  /**
   * ETH entered as deposit when configuring a position.
   * TEMPORARILY tiny: a realistic value (e.g. '25') triggers leverage + "Choose Protection",
   * which stays loading without real swap quotes in the local app env.
   * Tracked in https://github.com/Aphelion-Co/sov-e2e-tests/issues/73
   * See docs/anvil-fork-playwright-testing.md#deposit-amounts-on-the-fork
   */
  ethDeposit: '0.001',
  /** WETH minted per test account in setup; covers a full-size WETH deposit */
  wethFunding: 100,
} as const;
