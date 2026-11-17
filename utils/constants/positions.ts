/**
 * Open positions owned by the funded test wallet (TEST_WALLET_ADDRESS) on Base.
 *
 * Unlike vaults (resolved with getActiveVault), a position is test data tied to the wallet, so its
 * page is fixed. Tests must leave these positions open: they stop at rejecting the transaction.
 * If one gets closed, open a new small position with the test wallet and update its path here.
 */
export const TEST_WALLET_POSITIONS = {
  /** Multiply WETH/USDC on Aave v3, Base (~$1.3 net value, ~$0.33 debt) */
  multiplyAaveV3WethUsdcBase:
    '/products/multiply/aaveV3/8453/0xA238Dd80C259a72e81d7e4664a9801593F98d1c5-0x4200000000000000000000000000000000000006-0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/0x1c128e767c323e0cb4e1e4169859273cfd398222',
} as const;
