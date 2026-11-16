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
