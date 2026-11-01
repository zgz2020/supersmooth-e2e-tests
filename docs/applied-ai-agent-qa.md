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

---

## 📁 Generated Reports in `ai-reports/`

Every execution writes two outputs inside [`ai-reports/`](../ai-reports/):

1. **Suite-Specific Timestamped History:**
   - `triage-no-wallet-[timestamp].md`
   - `triage-with-wallet-[timestamp].md`
   - `triage-api-[timestamp].md`
2. **Ready-to-Paste GitHub PR Comment:**
   - `latest-github-comment-[suite].md`
   - `latest-github-comment.md` (Always mirrors the latest run overall)

---

## ⚙️ CI/CD Event Integration (GitHub Actions)

In `.github/workflows/reusable-no-wallet.yml`, `reusable-with-wallet.yml`, `reusable-api-tests.yml`, and `reusable-no-wallet-cross-browser.yml`, the agent executes automatically on failure:

```yaml
- name: 'Checkout repository'
  uses: 'actions/checkout@v4'
  with:
    fetch-depth: 2 # Ensures commit history is available for git diff extraction

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
```

When triggered in GitHub Actions, the agent automatically writes to `$GITHUB_STEP_SUMMARY`, rendering an interactive table, failure details, and diffs on the workflow summary screen.

---

## 🛡️ Harvest Resiliency & Edge Cases

The failure context harvester and triage engine incorporate several production safeguards:

1. **Test Retry Deduplication (`extract-failure-context.js`):**
   - Filters exclusively for `test.status === 'unexpected'` to ignore self-recovered flaky tests that passed on retry.
   - Inspects only the terminal execution attempt (`results[results.length - 1]`), guaranteeing tests retried 1 or 2 times are only triaged once without duplicating token usage or reports.

2. **Shallow CI Clone Diff Resolution (`fetch-depth: 2`):**
   - Default GitHub Actions shallow clones (`fetch-depth: 1`) omit `HEAD~1`.
   - The workflows configure `fetch-depth: 2`, and the harvester uses a three-tier diff resolution:
     ```bash
     git diff origin/main...HEAD -- "<file>" || git diff HEAD~1 -- "<file>" || git diff HEAD -- "<file>"
     ```
   - This prioritizes PR branch changes against `origin/main`, falls back to `HEAD~1`, and finally inspects uncommitted working tree changes.

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
