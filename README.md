# 🏛️ Sovereign E2E & Performance Testing Suite

End-to-end (E2E), API, and performance testing suite for the Sovereign (SOV) Web3 application using **Playwright**, **Synpress**, **Grafana k6**, **TypeScript**, and **pnpm**.

---

## 🚀 Tech Stack

- **E2E Testing:** [Playwright](https://playwright.dev/) (`@playwright/test`)
- **Web3 Wallet Automation:** [Synpress](https://github.com/Synthetixio/synpress) (`@synthetixio/synpress` v4) with MetaMask
- **Performance Testing:** [Grafana k6](https://k6.io/) & TypeScript
- **Applied AI & Agentic QA:** Google Gemini Flash (`gemini-flash-latest`), root-cause triage & autonomous self-healing (`agent:heal`), predictive PR change-impact analyzer (`agent:impact`), Discord webhook alerts
- **Language & Runtime:** [TypeScript](https://www.typescriptlang.org/) / Node.js (v20+ LTS via `.nvmrc`)
- **Package Manager:** [`pnpm`](https://pnpm.io/)

---

## ⚡ Quick Start

### 1. Prerequisites & Installation

Ensure you have Node.js (v20+) and `pnpm` installed:

```bash
# Switch to recommended Node version:
nvm use

# Install dependencies:
pnpm install

# Install Playwright browser binaries:
pnpm exec playwright install
```

### 2. Environment Configuration

Copy the sample environment file and configure variables:

```bash
cp .env.example .env
```

### 3. Build Wallet Cache (Required for With-Wallet Tests)

```bash
pnpm synpress-build-cache:base
```

---

## 🧪 Essential Test Commands

| Test Suite           | Purpose                                                                        | Command                                        |
| :------------------- | :----------------------------------------------------------------------------- | :--------------------------------------------- |
| **No-Wallet E2E**    | User flows without Web3 wallet connectivity                                    | `pnpm test:no-wallet`                          |
| **With-Wallet E2E**  | MetaMask wallet connection, approvals, and trading                             | `pnpm test:with-wallet`                        |
| **API Suites**       | Direct backend HTTP endpoints & schema validation                              | `pnpm test:api`                                |
| **Cross-Browser**    | Responsive layout smoke matrix across engines & devices                        | `pnpm test:cross-browser`                      |
| **Performance**      | Grafana k6 high-throughput load and SLA tests                                  | `pnpm test:performance`                        |
| **Local dApp Fork**  | Runs `aphelion-app` locally with Anvil mainnet/L2 state                        | `pnpm app:fork`                                |
| **AI Test Triage**   | Diagnoses failed runs, isolates RPC flakiness, outputs self-healing diffs      | `pnpm agent:triage`                            |
| **AI Self-Healing**  | Automatically applies proposed selector patches and verifies fix in isolation  | `pnpm agent:heal`                              |
| **AI Route Crawler** | Dynamically discovers liquidity pools and audits routes for 404s (Issue #1649) | `pnpm agent:crawl` (or `pnpm agent:crawl:all`) |
| **Predictive CI**    | Analyzes PR git diffs and dynamically resolves targeted test sub-suites        | `pnpm agent:impact`                            |
| **Test Repeater**    | Interactive flakiness detection runner                                         | `pnpm test:repeat`                             |
| **Code Quality**     | TypeScript type check and ESLint verification                                  | `pnpm typecheck && pnpm lint`                  |

> 📖 **Full Command List:** For the exhaustive list of all 36+ scripts, CI flags, and targeted browser commands, see the **[Scripts & Test Suites Reference](docs/scripts-reference.md)**.

---

## ⚡ Performance Testing (Grafana k6)

Run targeted performance tests against local, staging, or production environments:

```bash
# Interactive menu (prompts for profile, targets & options):
pnpm test:performance:menu

# Run default smoke test (all scenarios, 1 VU, 30s):
pnpm test:performance

# Run targeted endpoint or page:
TARGET=earn pnpm test:performance:smoke
TARGET="earn,token-prices,rpc" pnpm test:performance:smoke
```

Every execution generates dual native reports in `performance-reports/`:

- **Itemised Checks Report (`report.html`)**: Assertions breakdown, KPI cards, and recent run history comparison table.
- **Grafana Time-Series Dashboard (`dashboard.html`)**: Time-series graphs for RPS, VUs, latency percentiles, and errors.

> 📖 **Deep Dive:** Workload profiles, tiered tagged SLAs, and CI dispatch are detailed in the **[Performance Testing Guide](docs/performance-testing-k6.md)**.

---

## 🛡️ Dynamic Vault Selection (`getActiveVault`)

To prevent brittle tests caused by deprecated or unlisted liquidity pools (e.g., Aave V3 market deprecations), tests dynamically query active, deposit-ready vaults at runtime:

```typescript
import { getActiveVault } from './utils/getActiveVault';

// Resolves active Base vault matching test wallet's funded collateral
const { url, collateral } = await getActiveVault(request, 'multiply', {
  network: 'Base',
  collateral: 'ETH',
});

await app.vaultPage.openPage(url, { collateral });
```

> 📖 **Deep Dive:** Architecture, query options, and HTML fallback mechanics are detailed in the **[Dynamic Vault Selection Guide](docs/dynamic-vault-selection.md)**.

---

## 🤖 Applied AI & Autonomous QA (`agent:triage`, `agent:heal` & `agent:impact`)

An event-driven Applied AI test failure triage, self-healing, and predictive CI acceleration system that diagnoses failed Playwright runs, isolates transient RPC/network flakiness from DOM selector drift and genuine regressions, repairs broken selectors, and predicts targeted test sub-suites from PR git diffs:

```bash
# 1. Triage recent test run failures:
pnpm agent:triage

# 2. Automatically apply proposed selector fixes & verify in Playwright isolation:
pnpm agent:heal

# 3. Apply fix, verify in isolation, and open an autonomous GitHub Pull Request:
pnpm agent:heal:pr

# 4. Predictively analyze PR change-impact and resolve targeted sub-suite:
pnpm agent:impact

# 5. Dynamically crawl active liquidity pool routes and audit for 404s (Issue #1649):
pnpm agent:crawl
```

- **Interactive CI Step Summary:** Automatically rendered to GitHub Actions `$GITHUB_STEP_SUMMARY` on `if: failure()`.
- **Autonomous Self-Healing PRs:** In CI (or via `--create-pr`), verified fixes are committed to dedicated branches and opened as PRs with `ai-self-heal` labels.
- **Batch Safety & Branch Retention:** Atomic `SnapshotRegistry` prevents state corruption during multi-failure repairs, and automated maintenance (`agent:cleanup-branches`) prunes stale/merged repair branches.
- **Predictive CI Acceleration:** Analyzes PR git diffs against component dependency graphs to execute only impacted specs (cutting CI duration by 35–70%) and skips non-code documentation changes entirely.
- **Dynamic Route Health Auditing:** Autonomously crawls live pools across Ethereum, Base, Robinhood, and Arbitrum to detect 404 boundaries and unhandled exceptions (resolving Issue #1649).
- **Sticky GitHub PR Bot:** In-place updates existing diagnostic comments on pull requests using `actions/github-script`.
- **Ready-to-Paste PR Comments:** Saved to `ai-reports/latest-github-comment-[suite].md` with GitHub alerts and diffs.
- **Discord Webhook Alerts:** Dispatches instant rich diagnostic cards to mobile/desktop Discord channels.

> 📖 **Deep Dive:** Architecture, failure taxonomy, and CI triggers are detailed in the **[Applied AI & Agentic QA Guide](docs/applied-ai-agent-qa.md)**.

---

## 📚 Documentation Hub

Detailed architectural documentation, setup guides, and references are organized under [`docs/`](docs/):

| Guide                                                             | Description                                                                    |
| :---------------------------------------------------------------- | :----------------------------------------------------------------------------- |
| **[📜 Scripts Reference](docs/scripts-reference.md)**             | Complete breakdown of all scripts in `package.json` with execution flags       |
| **[🤖 Applied AI & Agentic QA](docs/applied-ai-agent-qa.md)**     | Autonomous failure diagnosis, self-healing code repair, and predictive CI      |
| **[🛡️ Dynamic Vault Selection](docs/dynamic-vault-selection.md)** | Resilient runtime pool discovery helper (`getActiveVault`) preventing 404s     |
| **[🍴 Local dApp & Anvil Fork](docs/local-app-fork-testing.md)**  | Run `aphelion-app` locally against Anvil state fork with pre-funded balances   |
| **[🦊 Web3 Wallet Setup](docs/wallet-setup.md)**                  | Synpress v4 cache configuration, MetaMask automation, and wallet helpers       |
| **[⚡ Performance Testing](docs/performance-testing-k6.md)**      | Grafana k6 profiles, tiered tagged SLAs, and HTML reporting guide              |
| **[🔄 Cross-Repo CI Strategy](docs/ci-cross-repo-strategy.md)**   | Architecture, status reporting, and dispatch from `aphelion-app` to CI         |
| **[🌍 CI & GitHub Runs Reference](docs/ci-github-runs.md)**       | Regional IP geo-blocking, US proxy routing, and GitHub Actions troubleshooting |

---

## 📁 Repository Structure

```text
.
├── .github/workflows/          # CI and CD GitHub Actions workflow pipelines
├── ai-reports/                 # AI triage markdown diagnoses & PR comment markups
├── docs/                       # Architectural documentation & technical guides
├── scripts/                    # CLI test runners, repeater, and mock servers
│   └── qa-agent/               # Applied AI failure harvester & triage engine
├── src/                        # Page objects, modals, and test fixtures
├── tests/
│   ├── api/                    # API test suites and schemas
│   ├── e2e/                    # E2E test specs (no-wallet, with-wallet, cross-browser)
│   └── performance/            # Grafana k6 performance testing suite
└── utils/                      # Reusable Web3 helpers, constants, assertions
```

---

## 📊 Viewing Test Reports

After executing Playwright tests, open the interactive HTML test report:

```bash
pnpm exec playwright show-report
```
