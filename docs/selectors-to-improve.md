# Selectors to improve (needs `data-testid` in aphelion-app)

Some app elements have no test id or ARIA hook, so page objects find their value from a nearby
label with XPath (`following-sibling`, `ancestor`, or a Tailwind class). These locators break when
the app's layout or styling changes, even if the feature still works.

This is the list of those locators and the test id each one needs in
[aphelion-app](https://github.com/Aphelion-Co/aphelion-app). Once the app ships a test id, switch
the page object to `getByTestId(...)` and remove its row here.

## Rules

- **Prefer, in order:** `getByTestId`, `getByRole` / `getByLabel`, `getByText`. Use XPath only when
  none of these can reach the element.
- **Every new XPath locator gets a row in this table** in the same PR, with the test id it should
  have. List it by page object and method or field, not line number.
- Suggested ids follow the app's existing kebab-case style (`right-side-panel`,
  `liquidation-slider-price`, `sidebar-action-button`). A label-driven row (one component reused
  for many labels) gets a per-label suffix, e.g. `position-overview-net-value`.

## Locators

### Position page: Position Overview ([`src/pages/positionPage.ts`](../src/pages/positionPage.ts))

| Page object › locator                                                           | Element                                       | Current XPath                                                     | Suggested `data-testid`                                                        |
| :------------------------------------------------------------------------------ | :-------------------------------------------- | :---------------------------------------------------------------- | :----------------------------------------------------------------------------- |
| `overviewFields.multiple`                                                       | Multiply: `Multiple` value (e.g. `1.27x`)     | label `Multiple` → `following-sibling::span[1]`                   | `position-overview-multiple`                                                   |
| `overviewMetric('Liquidation Price')` (`overviewFields.liquidationPrice`)       | Headline Liquidation Price value              | label → `ancestor::div[1]/following-sibling::div[1]`              | `position-overview-liquidation-price`                                          |
| `overviewMetric('Loan to Value')` (`overviewFields.ltv`)                        | Headline Loan to Value value                  | label → `ancestor::div[1]/following-sibling::div[1]`              | `position-overview-ltv`                                                        |
| `overviewMetric(/^Total \S+ Exposure$/)` (`overviewFields.totalExposure`)       | Multiply: Total `<token>` Exposure value      | label → `ancestor::div[1]/following-sibling::div[1]`              | `position-overview-total-exposure`                                             |
| `overviewMetric('Borrowing')` (`getBorrowAmountsUsd`)                           | Borrow: Borrowing value in USD (e.g. `$1.01`) | label → `ancestor::div[1]/following-sibling::div[1]`              | `position-overview-borrowing`                                                  |
| `overviewValue('Net Value')` (`overviewFields.netValueUsd`, `getNetValueUsd`)   | Net Value in USD                              | label → `following-sibling::p[1]`                                 | `position-overview-net-value`                                                  |
| `overviewValue('Position Debt')` (`overviewFields.positionDebtUsd`)             | Multiply: Position Debt in USD                | label → `following-sibling::p[1]`                                 | `position-overview-position-debt`                                              |
| `overviewValue('Available to Withdraw')` (`overviewFields.availableToWithdraw`) | Available to Withdraw amount                  | label → `following-sibling::p[1]`                                 | `position-overview-available-to-withdraw`                                      |
| `getBorrowAmountsUsd` (collateral)                                              | Borrow: Collateral Locked in USD (`($8.50)`)  | label `Collateral Locked` → `following-sibling::div[1]/p[last()]` | `position-overview-collateral-locked-usd` (and `-amount` for the token amount) |

### Portfolio page: position cards ([`src/pages/portfolioPage.ts`](../src/pages/portfolioPage.ts))

| Page object › locator                                                                                                              | Element                       | Current XPath                                                                                                     | Suggested `data-testid`                                                                                                        |
| :--------------------------------------------------------------------------------------------------------------------------------- | :---------------------------- | :---------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------- |
| `cardStat(safe, title)` (`getBorrowAmountsUsd`, `getNetValueUsd`, `shouldShowNetValue`): `Net Value`, `Coll. Locked`, `Total Debt` | Stat value on a position card | label → `ancestor::div[contains(@class, "pb-1")][1]/following-sibling::div[1]` (also depends on a Tailwind class) | `portfolio-card-stat-<stat>` on the value (e.g. `portfolio-card-stat-net-value`), inside a card with `portfolio-position-card` |

### Right side panel: Close ([`src/pages/rightSidePanel/closePosition.ts`](../src/pages/rightSidePanel/closePosition.ts))

| Page object › locator                                                                                     | Element                                               | Current XPath                                            | Suggested `data-testid`                                         |
| :-------------------------------------------------------------------------------------------------------- | :---------------------------------------------------- | :------------------------------------------------------- | :-------------------------------------------------------------- |
| `rowValue('You will receive')` (`shouldReceive`, `shouldReceiveAmount`)                                   | Amount received on close                              | label → `following-sibling::*[1]`                        | `close-you-will-receive`                                        |
| `rowValue('Supersmooth Fee')` (`shouldHaveFee`)                                                           | Fee row value                                         | label → `following-sibling::*[1]`                        | `close-supersmooth-fee`                                         |
| `rowValue(label)` (`shouldHaveChange`: `Outstanding debt`, `Total collateral`, `Withdrawable collateral`) | Position Changes & Details row, `<current> → <after>` | label → `following-sibling::*[1]`, then its `p` children | `position-change-<row>` with `-current` / `-next` on each value |

### Right side panel: Adjust ([`src/pages/rightSidePanel/adjustPosition.ts`](../src/pages/rightSidePanel/adjustPosition.ts))

| Page object › locator                                                    | Element                                               | Current XPath                                                                | Suggested `data-testid`                                          |
| :----------------------------------------------------------------------- | :---------------------------------------------------- | :--------------------------------------------------------------------------- | :--------------------------------------------------------------- |
| `changeValues(label)` (`shouldHaveChange`)                               | Position Changes & Details row, `<current> → <after>` | heading → `following-sibling::div[1]`, label → `following-sibling::div[1]/p` | Same as Close: `position-change-<row>` with `-current` / `-next` |
| `orderLine(label).amount` (`shouldHaveOrderLine`: `Borrowing`, `Buying`) | Order Summary line, token amount                      | heading → `following-sibling::div[1]`, label → `following-sibling::div[1]/p` | `order-summary-<line>-amount`                                    |
| `orderLine(label).usd`                                                   | Order Summary line, USD value                         | label → `following-sibling::p[1]`                                            | `order-summary-<line>-usd`                                       |
| `shouldHaveFee`                                                          | Supersmooth Fee value                                 | label → `following-sibling::*[1]`                                            | `adjust-supersmooth-fee` (or one shared `supersmooth-fee`)       |

## Other missing hooks (not XPath)

- Step 2 action button (`Adjusting Position...`) lacks the `sidebar-action-button` test id that
  step 1 has.
