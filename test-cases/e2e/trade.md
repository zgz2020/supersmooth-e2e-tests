# Trade (Hyperliquid Perps & Spot)

Trade product pages (`/products/trade`) and deposits into HyperCore.

## E2E-TRADE-001: Perps and spot trade pages load their markets

- **Priority:** P1
- **Automation:** planned
- **Notes:** The route crawler (`pnpm agent:crawl`) does not cover Trade pages yet.

**Steps**

1. Open `/products/trade` and `/products/trade?market=spot` without a wallet

**Expected result**

- Both pages render a market list and price data, with no error screen

## E2E-TRADE-002: Deposit from Base prompt for a connected wallet

- **Priority:** P1
- **Automation:** planned

**Preconditions:** Test wallet connected on staging

**Steps**

1. Open the Trade page with the wallet connected
2. Open the "Deposit from Base" flow and enter a small amount
3. Reject the transaction in the wallet

**Expected result**

- The deposit form validates the amount against the wallet balance
- Rejecting leaves the form usable, with no error screen

## E2E-TRADE-003: Place and reject a perps order

- **Priority:** P2
- **Automation:** planned

**Preconditions:** Test wallet connected, with an agent wallet set up

**Steps**

1. Choose a market, enter a size and leverage, and submit the order
2. Reject the signature

**Expected result**

- The order preview shows size, leverage and estimated liquidation price
- Rejecting cancels cleanly and the form stays editable
