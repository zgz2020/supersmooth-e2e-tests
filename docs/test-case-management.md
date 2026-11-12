# 🧾 Test Case Management & Traceability

How test cases are documented, linked to automated tests and kept in sync, all inside this
repository (no external test management tool).

---

## 📋 Table of Contents

- [Overview](#overview)
- [The catalogue](#the-catalogue)
- [Linking a test to a case](#linking-a-test-to-a-case)
- [Running tests by priority](#running-tests-by-priority)
- [Planned cases: the coverage backlog](#planned-cases-the-coverage-backlog)
- [The traceability check](#the-traceability-check)
- [Everyday workflows](#everyday-workflows)
- [Conventions](#conventions)
- [Roadmap](#roadmap)

---

## 🔍 Overview

| Piece                                                                           | Role                                                                    |
| :------------------------------------------------------------------------------ | :---------------------------------------------------------------------- |
| [`test-cases/`](../test-cases/README.md)                                        | Catalogue of test cases (Markdown), one file per feature area           |
| [`utils/testCase.ts`](../utils/testCase.ts)                                     | `tc('<ID>')` helper that links a Playwright test to a case              |
| [`scripts/tc/check-traceability.js`](../scripts/tc/check-traceability.js)       | `pnpm tc:check`: validates the links and prints a coverage table        |
| [`test-case-traceability.yml`](../.github/workflows/test-case-traceability.yml) | Runs the check on PRs and on `main`, posts the table to the job summary |

The catalogue says **what** is tested (including manual and planned cases). The Playwright test
is the executable specification of every `automated` case, so automated cases don't repeat steps.
Both live in the same Git history, so they are reviewed together and cannot drift silently.

---

## 📚 The catalogue

```text
test-cases/
├── README.md               # format reference
├── api/                    # API-<AREA>-NNN
│   ├── compliance.md
│   ├── rpc.md
│   └── ...
└── e2e/                    # E2E-<AREA>-NNN
    ├── navigation.md
    ├── open-position.md
    └── ...
```

Each case is a level-2 heading plus fields:

```markdown
## API-COMP-009: Flag sanctioned wallet address

- **Priority:** P1
- **Automation:** automated
```

`manual`, `planned` and `not-automatable` cases also need **Steps** and **Expected result**
sections. See [`test-cases/README.md`](../test-cases/README.md) for the full format.

---

## 🔗 Linking a test to a case

Pass `tc('<ID>')` as the test details argument:

```ts
import { tc } from '../../utils/testCase';

test('should flag sanctioned wallet address', tc('API-COMP-009'), async ({ request, baseURL }) => {
  // ...
});
```

The ID is stored as a Playwright `tc` annotation, so it appears in the HTML and JSON reports next
to each result. Data-driven loops declare the test once, so all variants share one ID:

```ts
for (const method of unsupportedMethods) {
  test(`should return 405 method not allowed for ${method}`, tc('API-COMP-003'), async () => {
    // ...
  });
}
```

---

## 🎯 Running tests by priority

`tc()` also tags each test with its case's catalogue priority: `@p1`, `@p2` or `@p3`. The tag comes
from the catalogue at load time, so changing a case's **Priority** re-tags its test with no code
change.

```bash
pnpm test:api --grep @p1                 # P1 only: core flows and security (fast smoke run)
pnpm test:api --grep-invert @p3          # everything except low-risk hardening cases
pnpm test:no-wallet --grep @p1
```

`tc()` and `pnpm tc:check` share one parser ([`scripts/tc/catalogue.js`](../scripts/tc/catalogue.js)),
so ID rules and priorities cannot drift apart. Tags such as `@regression`, `@api_nightly` and `@fork`
still choose the suite; priority tags filter within it.

---

## 🗺️ Planned cases: the coverage backlog

The catalogue lists what **should** be tested, not only what already is. Areas with no automated
test yet have `planned` cases (with **Steps** and **Expected result**), so the coverage table in
`pnpm tc:check` shows real gaps instead of 100%:

| File                                                                       | Covers                                                                                |
| :------------------------------------------------------------------------- | :------------------------------------------------------------------------------------ |
| `api/positions.md`                                                         | Position history, PnL, performance, fees, borrow costs, Borrow/Earn links             |
| `api/markets.md`                                                           | Product detail, rate history, market overview, liquidation risk, Earn and Morpho data |
| `api/trading.md`                                                           | Swap quotes, fee entitlements, CCTP relay, Hyperliquid icons                          |
| `api/automation.md`                                                        | Automation subscriptions, Shield                                                      |
| `api/platform.md`                                                          | Health, indexer, client errors, consent, support, invites                             |
| `api/admin-security.md`                                                    | Access control of cockpit, scheduled jobs, MCP OAuth and debug endpoints              |
| `e2e/trade.md`, `e2e/portfolio.md`, `e2e/automations.md`, `e2e/migrate.md` | Untested UI journeys                                                                  |
| `e2e/protocol-cases.md` (PROTO-006/007)                                    | Known fork gaps (#72, #73)                                                            |

To pick up a planned case: write the test with `tc('<ID>')` and change its **Automation** to
`automated` in the same PR (`tc:check` fails if either side is missing). New app areas should get
`planned` cases when they ship, so gaps stay visible.

---

## ✅ The traceability check

```bash
pnpm tc:check                            # list tests and validate
pnpm tc:check --report tc-coverage.md    # also write the summary to a file
pnpm tc:check --list-file results.json   # reuse an existing Playwright JSON report
```

It runs `playwright test --list` (no browser, wallet or network needed) and fails when:

| Rule                                                                | Typical fix                                |
| :------------------------------------------------------------------ | :----------------------------------------- |
| A test has no `tc()` link                                           | Add a case to the catalogue and link it    |
| A test links an ID that is not in the catalogue                     | Fix the typo or add the case               |
| An ID is linked from more than one test declaration                 | Give the second test its own case          |
| A case marked `automated` has no linked test                        | Link the test, or change the case's status |
| A linked case is marked `manual` / `planned` / `not-automatable`    | Change the status to `automated`           |
| Malformed catalogue entry (ID format, duplicate ID, invalid fields) | Fix the entry                              |

Manual / planned cases without **Steps** produce a warning, not a failure.

The `unit` project (helper unit tests in `tests/unit/`) and k6 scenarios are not part of the
check.

---

## 🔁 Everyday workflows

**Automating a new scenario**

1. Add the case to the relevant `test-cases/**/*.md` file with the next free ID.
2. Write the test with `tc('<ID>')`.
3. Run `pnpm tc:check`, then push. Case and test are reviewed in the same PR.

**Documenting a manual or planned case**: add it with `Automation: manual` (or `planned`), plus
Steps and Expected result. When it gets automated later, link the test and switch it to
`automated`.

**Finding the test for a case**: search the ID (`git grep API-COMP-009`) or filter the HTML report
by the `tc` annotation.

**Removing a test**: delete its case in the same PR (or mark it `manual` if it should still be
checked by hand).

---

## 📏 Conventions

- **ID format:** `<TYPE>-<AREA>-<NNN>`. `TYPE` is `API`, `E2E` or `PERF`; `AREA` is a short code
  per catalogue file (`COMP`, `RPC`, `NAV`, `POS`, ...); `NNN` is a zero-padded sequence.
- **IDs are permanent:** never renumber or reuse; renaming a test keeps its ID.
- **Priority:** `P1` core flows and security, `P2` validation and edge cases, `P3` low-risk
  hardening (405 responses, ignored query parameters).
- **Tags vs IDs:** tags (`@regression`, `@api_nightly`, `@fork`, `@cross-browser`) decide which
  suite runs a test; IDs give traceability. Keep both.

---

## 🧭 Roadmap

- **Run status per case:** publish run history with Allure Report (or ReportPortal) and surface
  the `tc` annotation as a link to the catalogue.
- **Manual regression runs:** generate a GitHub issue checklist from `manual` cases before each
  release.
- **Dedicated tool (only if needed):** if manual testing grows (assigned runs, sign-off reports),
  import the catalogue into Kiwi TCMS through its API.
