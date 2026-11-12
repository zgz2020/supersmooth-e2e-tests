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
- **Automation:** planned
- **Notes:** Blocked by [sov-e2e-tests#73](https://github.com/Aphelion-Co/sov-e2e-tests/issues/73): needs real swap quotes and the fee-entitlement key in the local app env.

**Preconditions:** `pnpm app:fork` running with swap provider keys; fork wallet funded

**Steps**

1. Open an Ethereum Multiply vault and deposit `FORK_AMOUNTS.ethDeposit` set to a realistic value (10-100 ETH)
2. Go through "Choose Protection" and "Set up Protection"
3. Sign Terms and confirm the transaction

**Expected result**

- Every step's button becomes clickable (no endless loading)
- The position opens on the fork and the position page shows the expected exposure and leverage

## E2E-PROTO-007: Server-side and browser data come from the same fork

- **Priority:** P2
- **Automation:** planned
- **Notes:** Blocked by [sov-e2e-tests#72](https://github.com/Aphelion-Co/sov-e2e-tests/issues/72): the app server reads `app:fork`'s node, the browser reads the worker's node.

**Steps**

1. In a fork test, fund the wallet with a distinctive token amount via `anvilFork.fundToken`
2. Open a page whose data is rendered server-side (e.g. portfolio)

**Expected result**

- The server-rendered data shows the funded amount, matching the browser-side balance
