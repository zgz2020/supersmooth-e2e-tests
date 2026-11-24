# Known App Bugs

Tests that fail because of a confirmed bug in the app (not in the tests) are kept running and
marked as expected failures with `knownAppBug(issueUrl, reason)` from
[`src/fixtures/knownAppBug.ts`](../src/fixtures/knownAppBug.ts).

## How it works

- While the bug reproduces, the test is reported as **passed** (expected failure), so the suite stays green.
- When the app is fixed, the test **fails** with "expected to fail, but passed". That is the signal to remove the marker and its row below, in the same PR.
- Some expected failures compare live values, so they depend on market prices, not only on the bug. The Portfolio value tests (`portfolioPositionValues.spec.ts`) compare a card value the indexer recorded at the position's last on-chain event with today's position page. On a day when prices are back near that event, or when a different position becomes the largest of its kind, the values can match and the test reports "expected to fail, but passed" with no app change. Check the attached `position` annotation and the two values before removing a marker: drop it only if the bug is fixed, otherwise rerun. Morpho Borrow is the closest to this (collateral off by 2.8%, tolerance 2%).
- The issue link is attached to the test as an `issue` annotation and shows in the Playwright HTML report.

## Adding a known bug

1. File the bug in the app repo (see the issue template used for `aphelion-app`).
2. Add `knownAppBug('<issue url>', '<one-line reason>')` as the first statement of the test body.
3. Add a row to the table below.

## Current known bugs

| Issue                                                                        | Test                                                                                                                                                      | Added      | Summary                                                                                                      |
| :--------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----------------------------------------------------------------------------------------------------------- |
| [aphelion-app#1689](https://github.com/Aphelion-Co/aphelion-app/issues/1689) | `tests/e2e/no-wallet/portfolioPositionValues.spec.ts` › EulerV2 Borrow card should show the collateral and debt of its position page                      | 2026-11-24 | Euler Borrow card shows `—` for Total Debt                                                                   |
| [aphelion-app#1689](https://github.com/Aphelion-Co/aphelion-app/issues/1689) | `tests/e2e/no-wallet/portfolioPositionValues.spec.ts` › AaveV3 / Morpho / Spark Borrow card should show the collateral and debt of its position page      | 2026-11-24 | Portfolio Borrow cards show different (or `—`) collateral and debt than the position page                    |
| [aphelion-app#1689](https://github.com/Aphelion-Co/aphelion-app/issues/1689) | `tests/e2e/no-wallet/portfolioPositionValues.spec.ts` › AaveV3 / AaveV3Lido / Fluid / Morpho Multiply card should show the Net Value of its position page | 2026-11-24 | Portfolio Multiply cards show a different Net Value than the position page (e.g. Fluid card $13, page $5.90) |
| [aphelion-app#1690](https://github.com/Aphelion-Co/aphelion-app/issues/1690) | `tests/e2e/no-wallet/portfolioPositionValues.spec.ts` › CompoundV3 Multiply card should show the Net Value of its position page                           | 2026-11-24 | Compound V3 Multiply position page shows a Net Value of ~$0 (card shows $12)                                 |
