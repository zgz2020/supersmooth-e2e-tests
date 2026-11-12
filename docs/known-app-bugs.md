# Known App Bugs

Tests that fail because of a confirmed bug in the app (not in the tests) are kept running and
marked as expected failures with `knownAppBug(issueUrl, reason)` from
[`src/fixtures/knownAppBug.ts`](../src/fixtures/knownAppBug.ts).

## How it works

- While the bug reproduces, the test is reported as **passed** (expected failure), so the suite stays green.
- When the app is fixed, the test **fails** with "expected to fail, but passed". That is the signal to remove the marker and its row below, in the same PR.
- The issue link is attached to the test as an `issue` annotation and shows in the Playwright HTML report.

## Adding a known bug

1. File the bug in the app repo (see the issue template used for `aphelion-app`).
2. Add `knownAppBug('<issue url>', '<one-line reason>')` as the first statement of the test body.
3. Add a row to the table below.

## Current known bugs

| Issue                                                                        | Test                                                                                                          | Added      | Summary                                                                                             |
| :--------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------ | :--------- | :-------------------------------------------------------------------------------------------------- |
| [aphelion-app#1667](https://github.com/Aphelion-Co/aphelion-app/issues/1667) | `tests/e2e/anvil/protocolCases.spec.ts` › should recover the vault page once a temporary RPC rate limit lifts | 2026-11-12 | Vault page stays on loading skeleton forever after a single `/api/rpc` 429; no retry or error state |
