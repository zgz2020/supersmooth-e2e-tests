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
- **Automation:** automated
- **Notes:** `@regression`. Picks one random open position of any wallet from the indexer's
  public GraphQL API ([`utils/getOpenPositions.ts`](../../utils/getOpenPositions.ts)), leaving
  out kinds whose page is broken by an open app bug (none today). Opens the
  owner's Portfolio without a wallet, clicks the card and expects the Position Overview. Whether
  each kind of position page loads is covered by E2E-PPAGE-001.

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

## E2E-PORT-004: Portfolio Borrow card shows the collateral and debt of its position page

- **Priority:** P1
- **Automation:** automated
- **Notes:** Data-driven, one test per Borrow protocol, with positions found the same way as
  E2E-PORT-002 (no wallet needed). Compares the card's `Coll. Locked` and `Total Debt` with the
  position page's `Collateral Locked` and `Borrowing` (USD), within $1 (the card rounds to whole
  dollars) or 2%. Mismatching protocols are expected failures while
  [aphelion-app#1689](https://github.com/Aphelion-Co/aphelion-app/issues/1689) is open.

**Steps**

1. Open the Portfolio of a wallet with an open Borrow position and note the card's Coll. Locked
   and Total Debt
2. Open the position page from the card and read Collateral Locked and Borrowing (USD)

**Expected result**

- The card shows a number for both (Portfolio only lists open, non-empty positions, so `—` is a
  failure)
- They match the position page (within display rounding)

## E2E-PORT-005: Portfolio Multiply card shows the Net Value of its position page

- **Priority:** P1
- **Automation:** automated
- **Notes:** Data-driven, one test per Multiply protocol, with positions found the same way as
  E2E-PORT-002 (no wallet needed). Compares the card's `Net Value` with the position page's
  `Net Value` (USD), within $1 (the card rounds to whole dollars) or 2%. Mismatching protocols
  are expected failures while
  [aphelion-app#1689](https://github.com/Aphelion-Co/aphelion-app/issues/1689) is open; Compound V3
  while [aphelion-app#1690](https://github.com/Aphelion-Co/aphelion-app/issues/1690) is open (its
  position page shows a Net Value of ~$0).

**Steps**

1. Open the Portfolio of a wallet with an open Multiply position and note the card's Net Value
2. Open the position page from the card and read its Net Value

**Expected result**

- The card shows a number (`—` is a failure)
- It matches the position page (within display rounding)
