# Manage Position (with wallet)

Journeys on an existing position page with the funded MetaMask wallet (Synpress), stopping at the
first transaction so the position stays open.

**Test data:** the test wallet's open positions are listed in
[`utils/constants/positions.ts`](../../utils/constants/positions.ts). If a position gets closed, open
a new small one with the test wallet and update its path there.

## E2E-MPOS-001: Close Multiply position - until rejecting first transaction

- **Priority:** P1
- **Automation:** automated

**Preconditions:** Test wallet with an open Multiply WETH/USDC position on Aave v3, Base

## E2E-MPOS-002: Adjust risk up on Multiply position - until rejecting first transaction

- **Priority:** P1
- **Automation:** automated
- **Notes:** Raises the LTV by 20 points from its current value and checks the slider values, Order
  Summary, Position Changes & Details and the overview's Next Position Simulation against the
  expected multiple, liquidation price, debt and collateral.

**Preconditions:** Test wallet with an open Multiply WETH/USDC position on Aave v3, Base

## E2E-MPOS-003: Net Value matches the close payout on a Multiply position

- **Priority:** P1
- **Automation:** automated
- **Notes:** Regression test for
  [aphelion-app#1690](https://github.com/Aphelion-Co/aphelion-app/issues/1690) (Net Value read ~$0
  on a Compound V3 Multiply on Arbitrum while closing paid out over $13). Reads the overview's Net
  Value, opens Close, closes to the debt token (USDC) and expects `You will receive` within 5%
  (min $0.05) of it. **To improve:** the test wallet holds only one very small position (Aave v3
  Multiply on Base, ~$1.2), which is not the protocol and chain where the bug was seen, so this
  test does not reproduce it. Widen it by opening more positions with the test wallet (at least
  Compound V3 Multiply on Arbitrum, with a few dollars of equity), or by finding a way to check the
  Close payout of positions held by other wallets (the Close tab is only shown to the owner).

**Preconditions:** Test wallet with an open Multiply WETH/USDC position on Aave v3, Base
