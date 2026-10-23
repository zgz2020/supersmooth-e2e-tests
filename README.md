# sov-e2e-tests

End-to-end (E2E) testing suite for the Sovereign (SOV) web3 application using Playwright, Synpress, TypeScript, and `pnpm`.

---

## 🚀 Tech Stack

- **Testing Framework:** [Playwright](https://playwright.dev/) (`@playwright/test`)
- **Web3 Wallet Automation:** [Synpress](https://github.com/Synthetixio/synpress) (`@synthetixio/synpress` v4)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Package Manager:** [`pnpm`](https://pnpm.io/)
- **Runtime:** Node.js (v20 LTS recommended via `.nvmrc`)

---

## 🛠️ Prerequisites

Ensure you have Node.js (v20+) and `pnpm` installed on your machine.

If you use `nvm`, switch to the recommended Node version:

```bash
nvm use
```

Install dependencies:

```bash
pnpm install
```

Configure environment variables:

```bash
cp .env.example .env
```

Install Playwright browsers (if needed):

```bash
pnpm exec playwright install
```

---

## 🦊 Synpress Wallet Setup

For tests requiring Web3 wallet interaction (e.g., MetaMask), ensure `TEST_WALLET_PK` (and optionally `TEST_WALLET_ADDRESS`) is defined in `.env`, then build the Synpress cache before running wallet test suites:

```bash
pnpm synpress-build-cache:base
```

---

## 🧪 Test Suites & How to Run

Tests are categorized into distinct projects defined in `playwright.config.ts`:

| Test Suite          | Description                                                  | Directory / Filter                  | Command                    |
| :------------------ | :----------------------------------------------------------- | :---------------------------------- | :------------------------- |
| **No-Wallet E2E**   | E2E tests that do not require Web3 wallet connection         | `./tests/e2e/no-wallet`             | `pnpm test:no-wallet`      |
| **With-Wallet E2E** | E2E tests requiring MetaMask wallet interaction via Synpress | `./tests/e2e/with-wallet`           | `pnpm test:with-wallet`    |
| **All E2E**         | Runs all end-to-end test suites                              | `./tests/e2e`                       | `pnpm test:e2e`            |
| **API Tests**       | API endpoint and integration test suites                     | `./tests/api`                       | `pnpm test:api`            |
| **API Regression**  | API regression suite excluding nightly-only tests            | `./tests/api` (`!@api_nightly`)     | `pnpm test:api:regression` |
| **API Fake Geo**    | API tests executing against local mock geo-compliance server | `complianceGeoFakeLocation.spec.ts` | `pnpm test:api:fake-geo`   |
| **All Tests**       | Runs all Playwright test projects                            | `./tests`                           | `pnpm test`                |

---

## 📜 Available Scripts

| Script                              | Description                                                       |
| :---------------------------------- | :---------------------------------------------------------------- |
| `pnpm test`                         | Runs all Playwright test projects                                 |
| `pnpm test:e2e`                     | Runs all E2E tests under `./tests/e2e`                            |
| `pnpm test:no-wallet`               | Runs E2E tests without Web3 wallet interactions                   |
| `pnpm test:no-wallet-regression`    | Runs no-wallet E2E regression tests (`--grep @regression`)        |
| `pnpm test:with-wallet`             | Runs E2E tests with MetaMask wallet automation via Synpress       |
| `pnpm test:with-wallet-regression`  | Runs with-wallet E2E regression tests (`--grep @regression`)      |
| `pnpm test:api`                     | Runs full API test suites                                         |
| `pnpm test:api:regression`          | Runs API tests excluding tests tagged with `@api_nightly`         |
| `pnpm test:api:fake-geo`            | Runs API tests with mock compliance geo server                    |
| `pnpm test:repeat`                  | Runs a test suite repeatedly to detect flakiness                  |
| `pnpm ci:synpress-build-cache:base` | Builds Synpress wallet cache inside virtual framebuffer (`xvfb`)  |
| `pnpm ci:no-wallet`                 | Runs no-wallet tests configured for CI with `xvfb` and 2 workers  |
| `pnpm ci:no-wallet-regression`      | Runs no-wallet regression tests in CI with `xvfb` and 2 workers   |
| `pnpm ci:with-wallet`               | Runs with-wallet tests configured for CI with `xvfb` and 1 worker |
| `pnpm ci:with-wallet-regression`    | Runs with-wallet regression tests in CI with `xvfb` and 1 worker  |
| `pnpm typecheck`                    | Validates TypeScript types across the codebase                    |
| `pnpm lint`                         | Runs ESLint checks across the codebase                            |
| `pnpm format`                       | Formats code with Prettier                                        |

---

## 🔁 Test Repeater (Flakiness Checker)

To verify test reliability or detect flakiness across consecutive executions, use the test repeater utility:

```bash
pnpm test:repeat
```

### Interactive Mode

When invoked without arguments, the script prompts for the target suite and iteration count:

1. **Select suite:** `1` (`api`), `2` (`api:regression`), `3` (`no-wallet`), or `4` (`with-wallet`)
2. **Number of iterations:**
   - **API tests (`api`, `api:regression`):** Limited to at most 2 runs (1-2 times) with a warning that running more times might trigger rate-limiting errors (e.g. `'Too many calls'`).
   - **E2E tests (`no-wallet`, `with-wallet`):** Configurable between 2 and 5 runs.

### Non-Interactive / CLI Mode

You can also specify the suite and iteration count directly via command-line arguments:

```bash
# Run API tests up to 2 times
pnpm test:repeat api 2

# Run API regression tests up to 2 times
pnpm test:repeat api:regression 2

# Run no-wallet E2E tests 3 times (between 2 and 5)
pnpm test:repeat no-wallet 3

# Run with-wallet E2E tests 5 times (between 2 and 5)
pnpm test:repeat with-wallet 5
```

The tool tracks elapsed time per iteration and halts immediately if any run fails.

---

## 🌐 Wallet & Network Utilities

Helper functions located in `./utils`:

- **`connectWallet({ app, metamask, network? })`**: Connects MetaMask wallet to the dApp and switches to the specified network (defaults to `'Base'`).
- **`switchNetwork({ app, metamask, network })`**: Opens the network selector modal, switches to the specified network (`FixturesNetwork`: `'Arbitrum One' | 'Base' | 'Ethereum' | 'HyperEVM' | 'OP Mainnet'`), and automatically approves new network additions and network switches in MetaMask.
- **`verifyTermsAndAcceptIfNeeded({ app, metamask, address?, collateral?, depositAmount?, url? })`**: Verifies whether the specified wallet address has accepted the Terms of Service via `/api/terms/status`. If unsigned, it navigates to the position page, inputs a deposit, opens the position to trigger the Terms of Service modal, accepts and signs the terms in both the dApp and MetaMask, and polls `/api/terms/status` using Playwright `expect.poll` until verified. Also integrated directly into the `app` test fixture (`src/fixtures/base.ts`) to ensure wallets are terms-approved before executing with-wallet tests.

---

## 🤖 GitHub Actions Workflows

Continuous Integration (CI) and scheduled workflows are organized under `.github/workflows/`:

### Scheduled & Trigger Workflows

- **Nightly Run (`nightly.yml`)**: Scheduled cron workflow that triggers on Monday, Wednesday, and Friday at 01:00 UTC (`0 1 * * 1,3,5`). Executes the full API test suite, no-wallet E2E suite, and with-wallet E2E suite in parallel.
- **CI Regression Run (`ci-regression.yml`)**: Triggered via `workflow_dispatch` by the [aphelion-app](https://github.com/Aphelion-Co/aphelion-app) repository when merging to `staging`. Accepts `run_id`, `repository`, and `commit_sha` from the triggering workflow and executes the regression test suites in parallel:
  - API regression (`test:api:regression`)
  - No-wallet E2E regression (`ci:no-wallet-regression`)
  - With-wallet E2E regression (`ci:with-wallet-regression`)
    Upon completion, the `report-status` job evaluates the run outcome and delivers a green/red commit status check back to the calling commit in `aphelion-app`. For the complete architectural design and reference guide, see [Cross-Repository CI Strategy](docs/ci-cross-repo-strategy.md).
- **Manual Triggers (`workflow_dispatch`)**:
  - **API Tests (`api-tests.yml`)**: Runs API tests against a configurable `baseUrl` (defaults to `'https://staging.supersmooth.fi/'`).
  - **No-wallet Tests (`no-wallet-tests.yml`)**: Runs no-wallet E2E tests against a configurable `baseUrl`.
  - **No-wallet Regression Tests (`no-wallet-regression.yml`)**: Runs no-wallet regression E2E tests against a configurable `baseUrl`.
  - **With-wallet Tests (`with-wallet-tests.yml`)**: Runs with-wallet E2E tests against a configurable `baseUrl`, inheriting the `TEST_WALLET_PK` repository secret.
  - **With-wallet Regression Tests (`with-wallet-regression.yml`)**: Runs with-wallet regression E2E tests against a configurable `baseUrl`, inheriting the `TEST_WALLET_PK` repository secret.

### Reusable Workflows

- **`reusable-api-tests.yml`**: Runs API tests in `ubuntu-24.04`, uploading the report artifact as `api-tests`.
- **`reusable-no-wallet.yml`**: Runs no-wallet E2E tests inside the official Playwright Docker container (`mcr.microsoft.com/playwright:v1.49.0-noble`) with `xvfb`, uploading the report artifact as `no-wallet`.
- **`reusable-with-wallet.yml`**: Builds the Synpress MetaMask cache, runs with-wallet E2E tests in the Playwright Docker container with `xvfb`, and uploads the report artifact as `with-wallet`.

### Artifacts & Reports

Playwright HTML test reports are generated and preserved as GitHub Actions artifacts for 30 days upon test completion.

### 📖 Cross-Repository CI Documentation

For complete architectural details, sequence diagrams, token setup, script parity, and maintenance instructions, consult the reference documentation:

- [Cross-Repository CI Strategy Guide](docs/ci-cross-repo-strategy.md)
- [Cross-Repository CI Strategy (PDF)](docs/ci-cross-repo-strategy.pdf)

---

## 📁 Repository Structure

```text
.
├── .github/
│   └── workflows/
│       ├── api-tests.yml             # Manual API test workflow
│       ├── ci-regression.yml         # CI regression workflow triggered by aphelion-app
│       ├── nightly.yml               # Nightly scheduled cron workflow
│       ├── no-wallet-regression.yml  # Manual no-wallet regression E2E workflow
│       ├── no-wallet-tests.yml       # Manual no-wallet E2E workflow
│       ├── reusable-api-tests.yml    # Reusable API test runner
│       ├── reusable-no-wallet.yml    # Reusable no-wallet runner (containerized)
│       ├── reusable-with-wallet.yml  # Reusable with-wallet runner (containerized)
│       ├── with-wallet-regression.yml # Manual with-wallet regression E2E workflow
│       └── with-wallet-tests.yml     # Manual with-wallet E2E workflow
├── .env.example                      # Environment variables template
├── .gitignore
├── .nvmrc
├── docs/
│   ├── ci-cross-repo-strategy.md     # Cross-repo CI architecture reference guide
├── eslint.config.js
├── package.json
├── playwright.config.ts
├── README.md
├── scripts/
│   ├── mock-compliance-server.js     # Mock geo-compliance server
│   └── repeat-tests.js               # Interactive test repeater utility
├── src/
│   ├── app.ts                        # Main App fixture entry point
│   ├── fixtures/                     # Custom Playwright & Synpress fixtures (auto-terms acceptance)
│   ├── modals/                       # Modal dialog page objects (ConnectWallet, TermsOfService, etc.)
│   │   ├── connectWallet/            # Connect wallet modal & All Wallets search view
│   │   ├── settings/                 # Application settings modal
│   │   ├── walletFeatures/           # Wallet features and network selection modal
│   │   ├── getHelp.ts                # Help modal page object
│   │   └── termsOfService.ts         # Terms of Service modal page object
│   └── pages/                        # Page objects (Header, Multiply, VaultPage, etc.)
├── tests/
│   ├── api/                          # API test specs
│   └── e2e/
│       ├── no-wallet/                 # E2E test specs without wallet (connect wallet modal, navigation)
│       └── with-wallet/               # E2E test specs with Synpress MetaMask wallet (position opening)
└── utils/
    ├── assertions/                   # Custom matchers & assertion helpers
    ├── connectWallet.ts              # Helper to connect wallet and select network
    ├── globalSetup.ts                # Global setup logger for target BASE_URL
    ├── openPosition.ts               # Helper to configure and open positions
    ├── switchNetwork.ts              # Helper to switch network with MetaMask approvals
    ├── synpress/                     # Synpress wallet setup and cache utilities
    └── verifyTermsAndAcceptIfNeeded.ts # Verifies and accepts Terms of Service if needed
```

---

## 📊 View Test Reports

To view the HTML test report after running tests:

```bash
pnpm exec playwright show-report
```
