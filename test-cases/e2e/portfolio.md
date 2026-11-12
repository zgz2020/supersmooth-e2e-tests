# Portfolio

Portfolio overview and position pages for a connected wallet.

## E2E-PORT-001: Portfolio lists the wallet's open positions

- **Priority:** P1
- **Automation:** planned

**Preconditions:** Test wallet with at least one open position on staging

**Steps**

1. Connect the test wallet and open Portfolio

**Expected result**

- Every open position is listed with its product, network and a non-zero value
- The total equals the sum of the listed positions (within rounding)

## E2E-PORT-002: Open a position page from Portfolio

- **Priority:** P1
- **Automation:** planned

**Steps**

1. From Portfolio, open one of the listed positions

**Expected result**

- The position page loads with its stats (value, PnL, borrow cost) and no error screen

## E2E-PORT-003: Empty portfolio state

- **Priority:** P3
- **Automation:** planned

**Steps**

1. Connect a wallet without positions (e.g. an Anvil dev account on the fork) and open Portfolio

**Expected result**

- An empty state with a call to action is shown instead of an empty table or an error
