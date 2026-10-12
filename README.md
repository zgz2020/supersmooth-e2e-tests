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

Install Playwright browsers (if needed):

```bash
pnpm exec playwright install
```

---

## 🦊 Synpress Wallet Setup

For tests requiring Web3 wallet interaction (e.g., MetaMask), build the Synpress cache before running wallet test suites:

```bash
pnpm synpress-build-cache:base
```

---

## 🧪 Test Suites & How to Run

Tests are categorized into distinct projects defined in `playwright.config.ts`:

| Test Suite          | Description                                                  | Directory / Filter                  | Command                  |
| :------------------ | :----------------------------------------------------------- | :---------------------------------- | :----------------------- |
| **No-Wallet E2E**   | E2E tests that do not require Web3 wallet connection         | `./tests/e2e/noWallet`              | `pnpm test:no-wallet`    |
| **With-Wallet E2E** | E2E tests requiring MetaMask wallet interaction via Synpress | `./tests/e2e/withWallet`            | `pnpm test:with-wallet`  |
| **All E2E**         | Runs all end-to-end test suites                              | `./tests/e2e`                       | `pnpm test:e2e`          |
| **API Tests**       | API endpoint and integration test suites                     | `./tests/api`                       | `pnpm test:api`          |
| **API Fake Geo**    | API tests executing against local mock geo-compliance server | `complianceGeoFakeLocation.spec.ts` | `pnpm test:api:fake-geo` |
| **All Tests**       | Runs all Playwright test projects                            | `./tests`                           | `pnpm test`              |

---

## 📜 Available Scripts

| Script                   | Description                                                 |
| :----------------------- | :---------------------------------------------------------- |
| `pnpm test`              | Runs all Playwright test projects                           |
| `pnpm test:e2e`          | Runs all E2E tests under `./tests/e2e`                      |
| `pnpm test:no-wallet`    | Runs E2E tests without Web3 wallet interactions             |
| `pnpm test:with-wallet`  | Runs E2E tests with MetaMask wallet automation via Synpress |
| `pnpm test:api`          | Runs API test suites                                        |
| `pnpm test:api:fake-geo` | Runs API tests with mock compliance geo server              |
| `pnpm test:repeat`       | Runs a test suite repeatedly to detect flakiness            |
| `pnpm typecheck`         | Validates TypeScript types across the codebase              |
| `pnpm lint`              | Runs ESLint checks across the codebase                      |
| `pnpm format`            | Formats code with Prettier                                  |

---

## 🔁 Test Repeater (Flakiness Checker)

To verify test reliability or detect flakiness across consecutive executions, use the test repeater utility:

```bash
pnpm test:repeat
```

### Interactive Mode

When invoked without arguments, the script prompts for the target suite and iteration count:

1. **Select suite:** `1` (`api`), `2` (`no-wallet`), or `3` (`with-wallet`)
2. **Number of iterations:**
   - **API tests (`api`):** Limited to at most 2 runs (1-2 times) with a warning that running more times might trigger rate-limiting errors (e.g. `'Too many calls'`).
   - **E2E tests (`no-wallet`, `with-wallet`):** Configurable between 2 and 5 runs.

### Non-Interactive / CLI Mode

You can also specify the suite and iteration count directly via command-line arguments:

```bash
# Run API tests up to 2 times
pnpm test:repeat api 2

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

---

## 📁 Repository Structure

```text
.
├── .gitignore
├── .nvmrc
├── eslint.config.js
├── package.json
├── playwright.config.ts
├── README.md
├── scripts/
│   ├── mock-compliance-server.js # Mock geo-compliance server
│   └── repeat-tests.js           # Interactive test repeater utility
├── src/
│   ├── app.ts                 # Main App fixture entry point
│   ├── fixtures/              # Custom Playwright & Synpress fixtures
│   ├── modals/                # Modal dialog page objects (ConnectWallet, ChooseNetwork, etc.)
│   └── pages/                 # Page objects (Header, Multiply, VaultPage, etc.)
├── tests/
│   ├── api/                   # API test specs
│   └── e2e/
│       ├── noWallet/          # E2E test specs without wallet
│       └── withWallet/        # E2E test specs with Synpress MetaMask wallet
└── utils/
    ├── assertions/            # Custom matchers & assertion helpers
    ├── connectWallet.ts       # Helper to connect wallet and select network
    ├── switchNetwork.ts       # Helper to switch network with MetaMask approvals
    └── synpress/              # Synpress wallet setup and cache utilities
```

---

## 📊 View Test Reports

To view the HTML test report after running tests:

```bash
pnpm exec playwright show-report
```
