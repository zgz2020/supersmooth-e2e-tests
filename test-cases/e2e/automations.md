# Automations

Stop loss, trailing stop, auto sell, take profit and Shield setup on positions.

E2E-AUTO-004 to E2E-AUTO-015 are **manual, real-network** checks that an armed automation really
executes on-chain, one per protocol / network / automation combination. They use real funds.

**Real-network execution procedure (shared by E2E-AUTO-004 to 015)**

- **Funds:** use a dedicated test wallet with the smallest position the protocol allows (a few
  dollars of collateral), plus gas on the network. Never use a team member's main wallet.
- **Triggering:** Stop-Loss, Auto Sell and Take Profit trigger on the position's **LTV**, so they
  can be triggered on purpose without waiting for the market:
  - Stop-Loss / Auto Sell: arm the trigger a little above the current LTV, then **borrow a small
    extra amount** so LTV rises past it.
  - Take Profit: arm the trigger a little below the current LTV, then **repay a little debt or add
    collateral** so LTV falls past it.
  - Trailing Stop-Loss follows the **price** from its peak, so it needs a real price move: use the
    tightest trailing distance allowed and run it during normal market volatility.
- **Evidence:** record the arming transaction, the keeper execution transaction (block explorer
  link), the time from trigger to execution, the balances before/after and a screenshot of the
  position page. Attach them to the test run.
- **Clean-up:** close any position left open and disarm leftover automations.

## E2E-AUTO-001: Configure a stop loss and reject the transaction

- **Priority:** P1
- **Automation:** planned

**Preconditions:** Test wallet connected, with an open Multiply position

**Steps**

1. Open the position page and choose "Stop Loss"
2. Set a trigger below the current price
3. Reject the transaction in the wallet

**Expected result**

- The form shows the trigger price and the estimated outcome; triggers above the current price are rejected by validation
- Rejecting keeps the form state and shows no error screen

## E2E-AUTO-002: Trailing stop and auto sell forms validate input

- **Priority:** P2
- **Automation:** planned

**Steps**

1. Open each automation form on an open position
2. Enter boundary values (0, negative, above the allowed maximum)

**Expected result**

- Invalid values are rejected with a clear message; the confirm button stays disabled

## E2E-AUTO-003: Active automation is shown on the position page

- **Priority:** P2
- **Automation:** planned
- **Notes:** Best done on the Anvil fork, where the transaction can be confirmed.

**Steps**

1. Set up a stop loss and confirm it
2. Reload the position page

**Expected result**

- The automation is listed as active with the configured trigger

## E2E-AUTO-004: Stop-Loss executes on Ethereum: Aave V3, close to debt

- **Priority:** P1
- **Automation:** manual
- **Notes:** Real network, real funds. Follow the real-network execution procedure at the top of this file.

**Preconditions:** Open Aave V3 position on Ethereum with a small real deposit, in the dedicated test wallet

**Steps**

1. Arm a Stop-Loss with **close to Debt**, trigger LTV a little above the current LTV
2. Borrow a small extra amount so LTV rises past the trigger
3. Wait for the keeper and record the execution transaction

**Expected result**

- The keeper executes within the expected time after LTV crosses the trigger
- The position is fully closed: no collateral or debt left on the protocol
- Proceeds arrive in the **debt asset**, net of the fees shown in the preview
- The automation shows as executed and is no longer armed

## E2E-AUTO-005: Stop-Loss executes on Base: Morpho, close to collateral

- **Priority:** P1
- **Automation:** manual
- **Notes:** Real network, real funds. Follow the real-network execution procedure at the top of this file.

**Preconditions:** Open Morpho position on Base with a small real deposit, in the dedicated test wallet

**Steps**

1. Arm a Stop-Loss with **close to Collateral**, trigger LTV a little above the current LTV
2. Borrow a small extra amount so LTV rises past the trigger
3. Wait for the keeper and record the execution transaction

**Expected result**

- The keeper executes within the expected time after LTV crosses the trigger
- The position is fully closed: no collateral or debt left on the protocol
- Proceeds arrive in the **collateral asset**, net of the fees shown in the preview
- The automation shows as executed and is no longer armed

## E2E-AUTO-006: Stop-Loss executes on Arbitrum: Compound V3, close to debt

- **Priority:** P1
- **Automation:** manual
- **Notes:** Real network, real funds. Follow the real-network execution procedure at the top of this file.

**Preconditions:** Open Compound V3 position on Arbitrum with a small real deposit, in the dedicated test wallet

**Steps**

1. Arm a Stop-Loss with **close to Debt**, trigger LTV a little above the current LTV
2. Borrow a small extra amount so LTV rises past the trigger
3. Wait for the keeper and record the execution transaction

**Expected result**

- The keeper executes within the expected time after LTV crosses the trigger
- The position is fully closed: no collateral or debt left on the protocol
- Proceeds arrive in the **debt asset**, net of the fees shown in the preview
- The automation shows as executed and is no longer armed

## E2E-AUTO-007: Trailing Stop-Loss executes on Ethereum: Aave V3 Lido, close to collateral

- **Priority:** P1
- **Automation:** manual
- **Notes:** Real network, real funds. Follow the real-network execution procedure at the top of this file.

**Preconditions:** Open Aave V3 Lido position on Ethereum with a small real deposit, in the dedicated test wallet

**Steps**

1. Arm a Trailing Stop-Loss with **close to Collateral** and the tightest trailing distance allowed
2. Note the peak price the automation tracks
3. Wait for the price to fall by the trailing distance from its peak; record the execution transaction

**Expected result**

- The trigger follows the peak price upwards and never moves down
- The keeper executes once the price falls by the trailing distance from the peak
- The position is fully closed and proceeds arrive in the **collateral asset**, net of preview fees
- The automation shows as executed and is no longer armed

## E2E-AUTO-008: Trailing Stop-Loss executes on Base: Euler, close to debt

- **Priority:** P1
- **Automation:** manual
- **Notes:** Real network, real funds. Follow the real-network execution procedure at the top of this file.

**Preconditions:** Open Euler position on Base with a small real deposit, in the dedicated test wallet

**Steps**

1. Arm a Trailing Stop-Loss with **close to Debt** and the tightest trailing distance allowed
2. Note the peak price the automation tracks
3. Wait for the price to fall by the trailing distance from its peak; record the execution transaction

**Expected result**

- The trigger follows the peak price upwards and never moves down
- The keeper executes once the price falls by the trailing distance from the peak
- The position is fully closed and proceeds arrive in the **debt asset**, net of preview fees
- The automation shows as executed and is no longer armed

## E2E-AUTO-009: Trailing Stop-Loss executes on Arbitrum: Morpho, close to collateral

- **Priority:** P1
- **Automation:** manual
- **Notes:** Real network, real funds. Follow the real-network execution procedure at the top of this file.

**Preconditions:** Open Morpho position on Arbitrum with a small real deposit, in the dedicated test wallet

**Steps**

1. Arm a Trailing Stop-Loss with **close to Collateral** and the tightest trailing distance allowed
2. Note the peak price the automation tracks
3. Wait for the price to fall by the trailing distance from its peak; record the execution transaction

**Expected result**

- The trigger follows the peak price upwards and never moves down
- The keeper executes once the price falls by the trailing distance from the peak
- The position is fully closed and proceeds arrive in the **collateral asset**, net of preview fees
- The automation shows as executed and is no longer armed

## E2E-AUTO-010: Auto Sell executes on Ethereum: Compound V3

- **Priority:** P1
- **Automation:** manual
- **Notes:** Real network, real funds. Follow the real-network execution procedure at the top of this file.

**Preconditions:** Open Compound V3 position on Ethereum with a small real deposit, in the dedicated test wallet

**Steps**

1. Arm Auto Sell with a trigger LTV a little above the current LTV and a lower target LTV
2. Borrow a small extra amount so LTV rises past the trigger
3. Wait for the keeper and record the execution transaction

**Expected result**

- The keeper executes within the expected time after LTV crosses the trigger
- Part of the collateral is sold and debt repaid: the position **stays open** with LTV at about the target
- Swap slippage stays within the configured limit
- The automation remains armed for future triggers (if configured to repeat)

## E2E-AUTO-011: Auto Sell executes on Base: Aave V3

- **Priority:** P1
- **Automation:** manual
- **Notes:** Real network, real funds. Follow the real-network execution procedure at the top of this file.

**Preconditions:** Open Aave V3 position on Base with a small real deposit, in the dedicated test wallet

**Steps**

1. Arm Auto Sell with a trigger LTV a little above the current LTV and a lower target LTV
2. Borrow a small extra amount so LTV rises past the trigger
3. Wait for the keeper and record the execution transaction

**Expected result**

- The keeper executes within the expected time after LTV crosses the trigger
- Part of the collateral is sold and debt repaid: the position **stays open** with LTV at about the target
- Swap slippage stays within the configured limit
- The automation remains armed for future triggers (if configured to repeat)

## E2E-AUTO-012: Auto Sell executes on Arbitrum: Morpho

- **Priority:** P1
- **Automation:** manual
- **Notes:** Real network, real funds. Follow the real-network execution procedure at the top of this file.

**Preconditions:** Open Morpho position on Arbitrum with a small real deposit, in the dedicated test wallet

**Steps**

1. Arm Auto Sell with a trigger LTV a little above the current LTV and a lower target LTV
2. Borrow a small extra amount so LTV rises past the trigger
3. Wait for the keeper and record the execution transaction

**Expected result**

- The keeper executes within the expected time after LTV crosses the trigger
- Part of the collateral is sold and debt repaid: the position **stays open** with LTV at about the target
- Swap slippage stays within the configured limit
- The automation remains armed for future triggers (if configured to repeat)

## E2E-AUTO-013: Take Profit executes on Ethereum: Spark

- **Priority:** P1
- **Automation:** manual
- **Notes:** Real network, real funds. Follow the real-network execution procedure at the top of this file.

**Preconditions:** Open Spark position on Ethereum with a small real deposit, in the dedicated test wallet

**Steps**

1. Arm Take Profit with a trigger LTV a little below the current LTV
2. Repay a little debt or add collateral so LTV falls past the trigger
3. Wait for the keeper and record the execution transaction

**Expected result**

- The keeper executes within the expected time after LTV crosses the trigger
- Profit is taken **into the debt asset** and sent to the owner, as described by the app
- Position values (collateral, debt, LTV) after execution match the preview
- The automation shows as executed

## E2E-AUTO-014: Take Profit executes on Base: Compound V3

- **Priority:** P1
- **Automation:** manual
- **Notes:** Real network, real funds. Follow the real-network execution procedure at the top of this file.

**Preconditions:** Open Compound V3 position on Base with a small real deposit, in the dedicated test wallet

**Steps**

1. Arm Take Profit with a trigger LTV a little below the current LTV
2. Repay a little debt or add collateral so LTV falls past the trigger
3. Wait for the keeper and record the execution transaction

**Expected result**

- The keeper executes within the expected time after LTV crosses the trigger
- Profit is taken **into the debt asset** and sent to the owner, as described by the app
- Position values (collateral, debt, LTV) after execution match the preview
- The automation shows as executed

## E2E-AUTO-015: Take Profit executes on Arbitrum: Aave V3

- **Priority:** P1
- **Automation:** manual
- **Notes:** Real network, real funds. Follow the real-network execution procedure at the top of this file.

**Preconditions:** Open Aave V3 position on Arbitrum with a small real deposit, in the dedicated test wallet

**Steps**

1. Arm Take Profit with a trigger LTV a little below the current LTV
2. Repay a little debt or add collateral so LTV falls past the trigger
3. Wait for the keeper and record the execution transaction

**Expected result**

- The keeper executes within the expected time after LTV crosses the trigger
- Profit is taken **into the debt asset** and sent to the owner, as described by the app
- Position values (collateral, debt, LTV) after execution match the preview
- The automation shows as executed
