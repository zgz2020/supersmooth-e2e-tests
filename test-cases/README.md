# Test case catalogue

Single source of truth for **what** we test. Each Markdown file groups the cases of one feature
area; automated cases are linked to their Playwright test with `tc('<ID>')`, and CI
(`pnpm tc:check`) keeps both sides in sync.

Full guide: [docs/test-case-management.md](../docs/test-case-management.md).

## Layout

| Folder  | ID prefix                                        | Contents                            |
| :------ | :----------------------------------------------- | :---------------------------------- |
| `api/`  | `API-<AREA>-NNN` (e.g. `API-COMP-001`)           | Backend API cases (`tests/api/`)    |
| `e2e/`  | `E2E-<AREA>-NNN` (e.g. `E2E-NAV-001`)            | UI journeys (`tests/e2e/**`)        |
| `perf/` | `PERF-<AREA>-NNN` (reserved, not catalogued yet) | k6 scenarios (`tests/performance/`) |

## Case format

```markdown
## E2E-NAV-020: Footer links open the correct pages

- **Priority:** P2
- **Automation:** manual
- **Notes:** Optional free text (links to issues, data-driven variants, ...)

**Preconditions:** Landing page open, no wallet connected

**Steps**

1. Scroll to the footer
2. Click each link

**Expected result**

- Each link opens the expected page in a new tab
```

| Field          | Values                                                                                             |
| :------------- | :------------------------------------------------------------------------------------------------- |
| **Priority**   | `P1` core / security, `P2` validation & edge cases, `P3` low-risk hardening (405s, ignored params) |
| **Automation** | `automated`, `manual`, `planned`, `not-automatable`                                                |

- `automated` cases only need the heading and fields: the linked test is the executable spec.
- `manual`, `planned` and `not-automatable` cases must include **Steps** and **Expected result**.

## Rules

1. IDs are permanent: never renumber, never reuse. Take the next free number in the file.
2. One test declaration ↔ one case. Data-driven loops share the ID of their declaration.
3. Renaming a test does not change its ID.
4. When a case is removed, delete its heading together with the linked test in the same PR.
