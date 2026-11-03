# 🤖 Applied AI & Agentic QA Triage Engine

The **Applied AI & Agentic QA Triage Engine** is an event-driven diagnostic system built into `sov-e2e-tests`. It automatically analyzes Playwright test failures, extracts failing context (code lines, locators, stack traces, and git diffs), classifies the failure root cause, and generates actionable self-healing code patches.

---

## 🎯 Key Capabilities & Value

- **⚡ 45% Faster Failure Resolution:** Eliminates manual Playwright trace downloads and log hunting by posting an instant, structured diagnosis in under 3 seconds.
- **🏷️ Intelligent Root-Cause Classification:** Separates transient RPC/testnet blips from DOM selector drift and real application regressions.
- **🩹 Self-Healing Code Patches:** Automatically generates proposed unified diffs for updated locators, element roles, and test parameters.
- **💸 Zero Token Waste & High Cost Efficiency:** The agent only triggers on failed runs (`if: failure()`); passing test suites consume **0 tokens ($0.00)**.
- **📣 Multi-Channel Delivery:** Streams rich GitHub-flavored markdown to `$GITHUB_STEP_SUMMARY`, writes local reports to `ai-reports/`, and dispatches alert cards to Discord webhooks.

---

## 🏗️ Architecture & Workflow

```mermaid
flowchart TD
    A[Playwright Test Fails] --> B[Artifact Harvester: extract-failure-context.js]
    B -->|Extracts Locators, Stack Trace, 20-line Code Context & Git Diff| C[Failure Context Payload]
    C --> D[AI Triage Engine: triage-agent.js]
    D -->|Calls Gemini API with Fallback| E{Classification Engine}
    E -->|TRANSIENT_RPC| F[Tag as Network/Node Blip - Advise Isolated Retry]
    E -->|DOM_SELECTOR_DRIFT| G[Generate Self-Healing Code Patch]
    E -->|REGRESSION_DEFECT| H[Generate Root-Cause Regression Bug Report]
    F --> I[Publish Multi-Channel Reports]
    G --> I
    H --> I
    I --> J[1. Render in GitHub Actions Step Summary]
    I --> K[2. Save to ai-reports/latest-github-comment-[suite].md]
    I --> L[3. Dispatch Embed Alert to Discord Webhook]
```

---

## 🏷️ Failure Classification Taxonomy

| Category                 | Typical Triggers                                                                         | Automated Triage Action                                                                                                                                   |
| :----------------------- | :--------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`TRANSIENT_RPC`**      | `ETIMEDOUT`, `ECONNREFUSED`, rate-limiting, socket hangs, nonce conflicts                | Tags failure as an infrastructure/node blip. Recommends retrying the specific spec without re-running the full 15-minute matrix, saving CI compute hours. |
| **`DOM_SELECTOR_DRIFT`** | Locator timeout, element not visible, DOM mutation, strict mode violations               | Identifies the failing locator, checks the Playwright trace, and generates a ready-to-copy code diff updating the selector.                               |
| **`REGRESSION_DEFECT`**  | Assertion mismatches (`expect(received).toEqual(expected)`), contract reverts, HTTP 500s | Flags a potential application code bug or breaking API schema change for developer investigation.                                                         |

---

## 🚀 Local Developer Usage

Run the triage agent at any time against the most recent test run:

```bash
pnpm agent:triage
```

### Example Terminal Output:

```text
🤖 [qa-agent] Starting Applied AI Test Triage...
⚠️  [qa-agent] Detected 1 failed test(s). Triaging top 1...

🔍 Analyzing: it should allow user to search for a wallet @regression (tests/e2e/no-wallet/connectWallet.spec.ts:19)
🏷️  Classification: [DOM_SELECTOR_DRIFT] (Confidence: 85%)
💡 Root Cause: Locator 'getByRole('button', { name: 'KriptoK' })' timed out or was not found in the DOM.
🛠️  Action: Inspect the DOM snapshot in the Playwright trace and update the locator in the page object or spec.
🩹 Patch:
// Update locator in tests/e2e/no-wallet/connectWallet.spec.ts:19
// Verify element visibility or adjust selector

📄 [qa-agent] Full report saved to: ai-reports/triage-no-wallet-20261101-195037.md
📋 [qa-agent] Ready-to-paste GitHub markup saved to: ai-reports/latest-github-comment-no-wallet.md
🏁 [qa-agent] Triage complete.
```

### 🩺 Autonomous Self-Healing & PR Creation (`pnpm agent:heal`)

Once a failure has been triaged, the self-healing agent parses proposed code patches from `ai-reports/`, updates target spec or page object files, re-executes the test in isolation to verify the fix, and can autonomously open a Pull Request:

```bash
# Preview proposed repairs without modifying code:
pnpm agent:heal --dry-run

# Automatically apply repairs and verify in Playwright isolation:
pnpm agent:heal

# Apply repairs without re-running Playwright verification:
pnpm agent:heal --no-verify

# Autonomously apply verified fix, commit to dedicated branch, and open GitHub PR:
pnpm agent:heal:pr
```

- **Rollback Safety & Batch Snapshot Registry:** Uses `SnapshotRegistry` to record base snapshots and verified intermediate states. When multiple tests fail in the same Page Object or spec file, failure of a subsequent patch rolls back exclusively to the last validated passing stage, ensuring earlier passing fixes in the same file are never overwritten.
- **Autonomous PR Generator:** When `--create-pr` is supplied (or in CI), the agent branches off (`ai-heal/<suite>-<timestamp>`), commits only the verified fixes, and pushes to the remote:
  - If GitHub Actions PR creation is enabled in organization settings, it opens a Pull Request automatically with the `ai-self-heal` label.
  - If organization policies restrict GitHub Actions from opening PRs directly (HTTP 403), the agent gracefully detects this, logs the new branch name, and generates a **1-click pre-filled Pull Request creation URL** in the CI job summary and logs.
- **Automated Branch Retention & Pruning (`pnpm agent:cleanup-branches`):**
  Prunes stale or merged `ai-heal/*` remote repair branches according to retention policy (default: 30 days):
  ```bash
  # Preview branches eligible for deletion without modifying remote:
  pnpm agent:cleanup-branches --dry-run

  # Prune merged branches and unmerged branches older than 30 days:
  pnpm agent:cleanup-branches
  ```
  Also runs autonomously every Sunday at 03:00 UTC via `.github/workflows/cleanup-ai-branches.yml`.

---

## ⚡ Predictive Test Selection & CI Acceleration (`pnpm agent:impact`)

The **Predictive Change-Impact Analyzer** (`scripts/qa-agent/pr-impact-analyzer.js`) accelerates CI feedback loops by mapping git diffs directly against the repository's component and test dependency graph.

### 🎯 Key Benefits:

- **⏱️ 35–70% Faster CI Feedback:** Instead of executing the full 25-minute test matrix on every commit, routine PRs run targeted sub-suites in ~2–6 minutes.
- **💸 Cloud Runner Compute Savings:** Slashes GitHub Actions runner minute consumption by executing only high-risk impacted specs.
- **⚪ 100% Savings on Docs/Metadata:** Pull requests modifying exclusively documentation (`.md`, `TODO.md`, `docs/`) or non-executable metadata skip browser runs entirely.

### 🛠️ Local Developer & CLI Usage:

```bash
# Analyze changes between origin/main and current HEAD:
pnpm agent:impact

# Analyze impact of specific changed files:
pnpm agent:impact --files="src/pages/vaultPage.ts"

# Output structured JSON:
pnpm agent:impact --files="src/pages/vaultPage.ts" --json

# Run unit verification tests for the impact engine:
pnpm test:agent
```

### 🗺️ Component-to-Test Dependency Mapping:

| Changed Component / Source Area                                     | Inferred Domain                | Targeted Playwright Spec(s)                                                                        |
| :------------------------------------------------------------------ | :----------------------------- | :------------------------------------------------------------------------------------------------- |
| `src/pages/vaultPage.ts`, `src/pages/rightSidePanel/**`             | Vault & Position Configuration | `tests/e2e/no-wallet/vaultPages.spec.ts`<br>`tests/e2e/with-wallet/openPosition.spec.ts`           |
| `src/pages/earn.ts`, `src/pages/multiply.ts`, `src/pages/borrow.ts` | Product Navigation & Discovery | `tests/e2e/no-wallet/earnProductsPage.spec.ts`<br>`tests/e2e/no-wallet/productsNavigation.spec.ts` |
| `src/pages/header.ts`, `src/pages/landingPage.ts`                   | Header & Landing Page          | `tests/e2e/no-wallet/topNavigation.spec.ts`                                                        |
| `src/modals/connectWallet/**`, `utils/synpress/**`                  | Web3 Wallet & Modals           | `tests/e2e/no-wallet/connectWallet.spec.ts`<br>`tests/e2e/with-wallet/openPosition.spec.ts`        |
| `utils/schema/api/compliance*`, `tests/api/compliance*`             | API Compliance & Geolocation   | `tests/api/complianceGeo.spec.ts`<br>`tests/api/complianceScreen.spec.ts`                          |
| `utils/schema/api/portfolio*`, `tests/api/portfolio*`               | API Portfolio & Strategies     | `tests/api/portfolioRecommendedStrategies.spec.ts`<br>`tests/api/portfolioSafes.spec.ts`           |
| `utils/schema/api/terms*`, `utils/schema/api/rpc*`                  | API Terms & RPC Contracts      | `tests/api/termsStatus.spec.ts`<br>`tests/api/rpc.spec.ts`                                         |
| `package.json`, `playwright.config.ts`, `tsconfig.json`             | Core Test Infrastructure       | Full Suite Regression (`FULL`)                                                                     |

---

## 🕷️ Autonomous Route Health Crawler & Route Auditor (`pnpm agent:crawl`)

The **Autonomous Route Crawler** (`scripts/qa-agent/crawl-vaults.js`) addresses dynamic DeFi liquidity pool link breakage (resolving **Aphelion-Co/aphelion-app#1649**). It dynamically crawls all active pool and market positions without requiring hand-crafted test files for each new pool.

### 🎯 Key Capabilities:

- **Comprehensive Route Discovery:** Discovers active liquidity pool routes from both top-cards endpoints (`/api/product-table/top-cards`) AND the **full product tables below top-cards** across all catalog pages (`/products/multiply`, `/products/borrow`, `/products/earn`), strategy views (`?strategy=yield-loops`, `?strategy=automated-strategies`), and table pagination pages across Ethereum (`1`), Base (`8453`), Robinhood (`4663`), and Arbitrum (`42161`).
- **404 & Error Boundary Detection:** Concurrently verifies every route for HTTP 200, absence of `"Page not found"` fallback boundaries, and absence of unhandled React error boundary crashes.
- **Automated Route Health Audit:** Generates markdown (`ai-reports/route-health-audit.md`) and JSON (`ai-reports/latest-route-audit.json`) audit reports with network-by-network health scores.
- **Auto-Scaffolder (`--scaffold`):** Generates boilerplate Playwright specs following repository POM conventions for newly launched pools.

### 🛠️ CLI Options & Usage:

```bash
# Run comprehensive audit across all top-cards and paginated product tables:
pnpm agent:crawl

# Filter crawl by chain (e.g. Robinhood network 4663 or Base 8453):
pnpm agent:crawl --chain=4663
pnpm agent:crawl --chain=8453

# Filter by product type:
pnpm agent:crawl --product=yieldLoop

# Cap audit to first N routes or adjust pagination depth:
pnpm agent:crawl --limit=50
pnpm agent:crawl --max-pages=5

# Audit only top-cards without paginating tables:
pnpm agent:crawl --top-cards-only

# Auto-scaffold new Playwright specs for discovered routes:
pnpm agent:crawl --scaffold

# Run unit tests:
pnpm test:agent
```

---

## 📁 Generated Reports in `ai-reports/`

Every execution writes outputs inside [`ai-reports/`](../ai-reports/):

1. **Structured JSON Data (Automation & Self-Healing):**
   - `latest-triage-data.json` (Machine-readable diagnostics for `pnpm agent:heal`)
   - `latest-route-audit.json` (Machine-readable route audit results from `pnpm agent:crawl`)
   - `latest-branch-cleanup.json` (Branch retention results from `pnpm agent:cleanup-branches`)
   - `latest-impact-analysis.json` (Predictive test selection from `pnpm agent:impact`)
2. **Markdown Audit & Triage History:**
   - `route-health-audit.md` (Autonomous route health and 404 audit report)
   - `triage-no-wallet-[timestamp].md`
   - `triage-with-wallet-[timestamp].md`
   - `triage-api-[timestamp].md`
3. **Ready-to-Paste GitHub PR Comments & Sticky Bot:**
   - `latest-github-comment-[suite].md`
   - `latest-github-comment.md` (Mirrors latest triage run)

---

## ⚙️ CI/CD Event Integration (GitHub Actions)

In `.github/workflows/reusable-no-wallet.yml`, `reusable-with-wallet.yml`, `reusable-api-tests.yml`, and `reusable-no-wallet-cross-browser.yml`, the agent executes automatically on failure:

```yaml
- name: 'Checkout repository'
  uses: 'actions/checkout@v4'
  with:
    fetch-depth: 0 # Ensures full commit history is available for AI failure triage diffs

# ... install and run tests ...

- name: '🤖 AI Agent Test Triage'
  if: failure()
  env:
    GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
    DISCORD_WEBHOOK_URL: ${{ secrets.DISCORD_WEBHOOK_URL }}
  run: pnpm agent:triage

- name: 'Upload AI Triage Report'
  uses: 'actions/upload-artifact@v4'
  if: failure()
  with:
    name: 'ai-triage-report-${{ inputs.script }}'
    path: 'ai-reports'
    retention-days: 30

- name: '💬 Post AI Triage Sticky Comment to PR'
  if: failure() && github.event_name == 'pull_request'
  uses: 'actions/github-script@v7'
  with:
    script: |
      // In-place updates existing triage comment or creates new one on PR
```

When triggered in GitHub Actions, the agent:

1. Automatically writes rich tables, diagnosis callouts, and collapsible stack traces to `$GITHUB_STEP_SUMMARY`.
2. Updates or posts a sticky diagnostic comment directly to the active GitHub Pull Request using `actions/github-script@v7`.
3. Dispatches embed alert cards to Discord via webhook.

---

## 🛡️ Harvest Resiliency & Edge Cases

The failure context harvester and triage engine incorporate several production safeguards:

1. **Test Retry Deduplication (`extract-failure-context.js`):**
   - Filters exclusively for `test.status === 'unexpected'` to ignore self-recovered flaky tests that passed on retry.
   - Inspects only the terminal execution attempt (`results[results.length - 1]`), guaranteeing tests retried 1 or 2 times are only triaged once without duplicating token usage or reports.

2. **Full CI Commit Graph Resolution (`fetch-depth: 0`):**
   - Default GitHub Actions shallow clones (`fetch-depth: 1`) omit commit history, making `git diff` impossible.
   - While `fetch-depth: 2` allows single-commit inspections, it breaks on branches with 3 or more commits or when comparing against `origin/main` because older commits and base branch refs are absent from the shallow clone.
   - All workflows configure `fetch-depth: 0` (full history), enabling the harvester to execute a four-tier diff resolution:
     ```bash
     git diff HEAD -- "<file>" || git diff origin/main...HEAD -- "<file>" || git diff HEAD~1 -- "<file>" || git log -p -n 1 -- "<file>"
     ```
   - This prioritizes uncommitted working tree changes (local dev), compares multi-commit branch diffs against `origin/main` (CI PRs), falls back to `HEAD~1`, and finally inspects the target file's own recent commit history (`git log -p`) to reliably capture selector mutations.
   - Because the repository is lightweight (~2 MB), `fetch-depth: 0` executes in under 1.2 seconds without breaking any downstream tooling or incurring network overhead.

3. **Dual Runtime HTTP Client (`triage-agent.js`):**
   - Uses native `globalThis.fetch` with `AbortSignal.timeout(15000)` on Node 20 LTS (the repository standard in `.nvmrc`).
   - Automatically falls back to built-in `node:https` on older or unaliased local development runtimes (< Node 18) to avoid runtime errors.

---

## 🔑 Environment Configuration

Add the optional variables to your `.env` (or GitHub Secrets for CI):

```bash
# Optional: Google Gemini API Key for deep LLM analysis (uses gemini-flash-latest)
GEMINI_API_KEY="AIzaSy... or AQ.Ab..."

# Optional: Discord incoming webhook for instant failure notifications
DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
```

> 🛡️ **Offline Resilient:** If `GEMINI_API_KEY` is unset or offline, the agent automatically falls back to its built-in pattern-matching heuristic classifier without throwing errors.
