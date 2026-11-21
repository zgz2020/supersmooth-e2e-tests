# Protocol Cases (Anvil fork)

Wallet, network and RPC edge cases on a local Anvil fork with an EIP-1193 mock provider.

## E2E-PROTO-001: Sign Terms of Service

- **Priority:** P1
- **Automation:** automated

## E2E-PROTO-002: Cleanly handle user rejection, preserve form state, and keep inputs editable

- **Priority:** P1
- **Automation:** automated

## E2E-PROTO-003: Reflect wallet network changes in the UI

- **Priority:** P1
- **Automation:** automated

## E2E-PROTO-004: Switch account and keep it after a page reload

- **Priority:** P1
- **Automation:** automated

## E2E-PROTO-005: Recover the vault page once a temporary RPC rate limit lifts

- **Priority:** P1
- **Automation:** automated
- **Notes:** Expected failure (`knownAppBug`) until [aphelion-app#1667](https://github.com/Aphelion-Co/aphelion-app/issues/1667) is fixed.

## E2E-PROTO-006: Open a Multiply position with a realistic deposit on the fork

- **Priority:** P1
- **Automation:** automated
- **Notes:** Runs in the full local stack suite (`pnpm test:fullstack`, [guide](../../docs/fullstack-e2e-testing.md)), not the Anvil worker suite: it needs real swap quotes, the contract deployment and the indexer, which resolves [sov-e2e-tests#73](https://github.com/Aphelion-Co/sov-e2e-tests/issues/73) for this flow. Each layer is checked against the one below it: the app database, the chain, the indexer, then the position page and the portfolio. Test: `tests/e2e/fullstack/openPosition.spec.ts`.

**Preconditions**

- The full local stack is up (`pnpm fullstack:up`, done by `pnpm test:fullstack`): an Anvil mainnet fork at the latest block with a fresh `core-v1` deployment, Ponder following it, and aphelion-app on its own migrated `sovereign_app` database with the Aave v3 product table filled
- A new wallet, generated for this test, with 100 ETH for gas; it has never accepted the terms and owns no Safe
- Scenario (one row of `SCENARIOS` in the spec): Aave v3, Ethereum, WETH collateral, 1 WETH deposit
- Only the browser's `/api/compliance/geo` and `/api/compliance/screen` calls are mocked (clean, unrestricted user). The terms signature, the swap quote and every transaction are real

**Steps**

1. Pick the vault: ask `getActiveVault` for the most liquid Aave v3 Multiply vault on Ethereum with WETH collateral (from the app's product table, filled from the fork), checking each candidate on chain until one can take the trade
2. Fund the wallet with the 1 WETH it deposits (wrapped from its ETH), open the vault page and wait for the wallet's WETH balance to show
3. Enter a deposit of 1 WETH
4. Click "Open Position" once it is enabled (a live swap quote and the transaction preview are ready)
5. In the Terms of Service modal, accept and sign
6. Wait for the open flow (Smart Account, then the position transactions) to finish. If the panel reports that a step reverted inside the Safe (GS013), click Retry, at most twice
7. Query the app database for the wallet's terms records
8. Check the receipt of every transaction the app sent through the wallet, then wait for Ponder to index the last of their blocks
9. Click "Go to position"
10. Read the Safe's collateral aToken and variable debt token balances on chain (token addresses from Aave's data provider for the chosen market) and compare them with the Position Overview
11. Read Ponder's latest position snapshot for the Safe
12. Open the wallet's portfolio (`/portfolio/<wallet>`)

**Expected result**

Vault choice (step 1)

- A candidate is used only if, on the fork: its collateral is WETH; both reserves are active, not frozen and not paused; the collateral is usable as collateral and the debt asset can be borrowed; the debt reserve has at least $50,000 available to borrow and that much room under its borrow cap; and the collateral has that much room under its supply cap
- The chosen vault is recorded as a `vault` annotation in the report, and each rejected candidate as `vault skipped` with its reasons. If none qualifies, the test fails before opening any page, listing every rejection

Opening (steps 2 to 6)

- The vault page shows a positive WETH balance for the wallet
- `POST /api/terms/accept` is sent for this wallet with a hex signature, returns 200 and `signed: true` (the server verified the EIP-712 signature)
- The panel shows "… position opened!" and an enabled "Go to position" button (allowed up to 150 s on a cold fork)
- The only failure retried is "Transaction failed: … (Safe code GS013)": the app simulated a step that would revert on the fork (the live swap quote does not hold against the fork's state), so nothing was sent. Each retry is recorded as an `open retried` annotation; any other failure, or a third revert, fails the test

App database (step 7), records for the wallet's lowercased address

- `terms_acceptances`: exactly one row, with a hex signature and a nonce
- `wallet_screenings`: at least one row, and none with `sanctioned = true` (`null`, the provider-unavailable marker, is accepted)
- `wallet_attribution`: no row, because the visit did not come through a `?ref=` / `utm_*` link

Chain and indexer (step 8)

- The app sent at least one transaction through the wallet
- Every one of them is mined with receipt status `0x1`
- Ponder's `/status` reaches the highest of their block numbers

Position page (steps 9 and 10)

- The URL ends in a Safe address (`/0x` + 40 hex characters)
- On chain, that Safe's only owner is the test wallet
- The Position Overview loads with a net value above zero (the page is reloaded if it times out on a cold fork, up to 3 min)
- On chain, the Safe holds more than 1 collateral aToken (leveraged above the 1 WETH deposit) and owes variable debt above zero
- The overview's Total WETH Exposure matches the Safe's collateral aToken balance within 1%
- The overview's Position Debt matches the Safe's variable debt, priced in USD with Aave's oracle, within 1%
- The overview's Multiple is above 1x

Portfolio and indexer (steps 11 and 12)

- Ponder holds a snapshot for the Safe; the latest one has `action` `open` and a `netValueUsd` above zero
- `/api/portfolio/safes` returns exactly one position for the wallet, with `dataQuality.source` `indexer` (not the `onchain-recovery` fallback)
- The portfolio shows a card linking to the Safe's position page
- The card's Net Value equals the snapshot's `netValueUsd` within $1 (the card shows whole dollars)

## E2E-PROTO-007: Server-side and browser data come from the same fork

- **Priority:** P2
- **Automation:** planned
- **Notes:** Blocked by [sov-e2e-tests#72](https://github.com/Aphelion-Co/sov-e2e-tests/issues/72): the app server reads `app:fork`'s node, the browser reads the worker's node.

**Steps**

1. In a fork test, fund the wallet with a distinctive token amount via `anvilFork.fundToken`
2. Open a page whose data is rendered server-side (e.g. portfolio)

**Expected result**

- The server-rendered data shows the funded amount, matching the browser-side balance

## E2E-PROTO-008: Open a Spark Multiply position on the full local stack

- **Priority:** P1
- **Automation:** automated
- **Notes:** The Spark scenario of the open-position test (`tests/e2e/fullstack/openPosition.spec.ts`, row `E2E-PROTO-008` of `SCENARIOS`). Same preconditions, steps and expected results as [E2E-PROTO-006](#e2e-proto-006-open-a-multiply-position-with-a-realistic-deposit-on-the-fork), with Spark in place of Aave v3: the vault is the most liquid Spark Multiply vault on Ethereum with WETH collateral that passes the same on-chain checks, read through Spark's own data provider and oracle (Spark runs Aave v3's contracts), and the stack fills Spark's product table.

## E2E-PROTO-009: Open an Aave Lido market Multiply position with wstETH on the full local stack

- **Priority:** P1
- **Automation:** automated
- **Notes:** The Aave Lido market scenario of the open-position test (`tests/e2e/fullstack/openPosition.spec.ts`, row `E2E-PROTO-009` of `SCENARIOS`). Same preconditions, steps and expected results as [E2E-PROTO-006](#e2e-proto-006-open-a-multiply-position-with-a-realistic-deposit-on-the-fork), with Aave's Lido market (`aaveV3Lido`) in place of the core market and wstETH in place of WETH: the vault is the most liquid `aaveV3Lido` Multiply vault on Ethereum with wstETH collateral that passes the same on-chain checks; the wallet is funded with 1 wstETH transferred from the market's wstETH aToken (wstETH cannot be wrapped from ETH); the overview's total exposure is compared in wstETH; and the stack fills the market's product table.
