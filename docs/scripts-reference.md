# 📜 Scripts & Test Suites Reference

A comprehensive guide to all `pnpm` scripts configured in [`package.json`](../package.json), organized by test suite, execution environment, and operational purpose.

---

## 📋 Table of Contents

- [Overview](#overview)
- [E2E Playwright Tests (No-Wallet)](#e2e-playwright-tests-no-wallet)
- [E2E Playwright Tests (With-Wallet / Synpress)](#e2e-playwright-tests-with-wallet--synpress)
- [Cross-Browser Suite](#cross-browser-suite)
- [API Testing Suites](#api-testing-suites)
- [Grafana k6 Performance Testing](#grafana-k6-performance-testing)
- [Test Utilities & AI Diagnostics](#test-utilities--ai-diagnostics)
- [Code Quality & Build](#code-quality--build)
- [Complete Reference Table](#complete-reference-table)

---

## 🔍 Overview

All tests can be executed locally or in CI environments using `pnpm`. Tests respect environment variables defined in `.env` (such as `BASE_URL`, `HEADLESS`, `WORKERS`, `REPORT_FOLDER`).

```bash
# General pattern:
pnpm <script_name>
```

---

## 🧪 E2E Playwright Tests (No-Wallet)

Located in `tests/e2e/no-wallet`. These tests validate user journeys that do not require Web3 wallet connectivity (e.g. landing page loads, product navigation, terms modals, read-only views).

| Script                           | Purpose                        | Details                                                      |
| :------------------------------- | :----------------------------- | :----------------------------------------------------------- |
| `pnpm test:no-wallet`            | Run all no-wallet tests        | Uses project `no-wallet` in Desktop Chrome                   |
| `pnpm test:no-wallet-regression` | Run regression no-wallet tests | Filters tests tagged with `@regression`                      |
| `pnpm ci:no-wallet`              | CI runner for no-wallet        | Runs in virtual framebuffer (`xvfb`) with 2 parallel workers |
| `pnpm ci:no-wallet-regression`   | CI runner for regression       | Runs tagged regression tests with `xvfb`                     |

---

## 🦊 E2E Playwright Tests (With-Wallet / Synpress)

Located in `tests/e2e/with-wallet`. Powered by **Synpress v4**, these tests automate MetaMask wallet actions, contract approvals, network switching, and position opening.

> [!IMPORTANT]
> Always build the Synpress wallet cache prior to running with-wallet tests locally. See the [Wallet Setup Guide](wallet-setup.md).

| Script                              | Purpose                          | Details                                               |
| :---------------------------------- | :------------------------------- | :---------------------------------------------------- |
| `pnpm synpress-build-cache:base`    | Build MetaMask cache locally     | Creates local wallet cache under `.cache-synpress`    |
| `pnpm ci:synpress-build-cache:base` | Build cache in CI                | Executes cache builder inside `xvfb`                  |
| `pnpm test:with-wallet`             | Run all with-wallet tests        | Uses project `with-wallet` with MetaMask fixture      |
| `pnpm test:with-wallet-regression`  | Run regression with-wallet tests | Filters with-wallet tests tagged with `@regression`   |
| `pnpm ci:with-wallet`               | CI runner for with-wallet        | Runs with 1 worker inside `xvfb` for wallet stability |
| `pnpm ci:with-wallet-regression`    | CI runner for regression         | Runs tagged wallet regression tests in `xvfb`         |

---

## 🌐 Cross-Browser Suite

Located in `tests/e2e/no-wallet-cross-browser`. Validates responsive layouts, navigation, and rendering across multiple engines and device form-factors.

| Script                                   | Engine / Target | Emulation / Viewport                            |
| :--------------------------------------- | :-------------- | :---------------------------------------------- |
| `pnpm test:cross-browser`                | **All Targets** | Runs all 6 browser/device projects sequentially |
| `pnpm test:cross-browser:firefox`        | Desktop Firefox | Gecko engine                                    |
| `pnpm test:cross-browser:webkit`         | Desktop Safari  | WebKit engine                                   |
| `pnpm test:cross-browser:mobile-safari`  | Mobile Safari   | iPhone 14 viewport & touch emulation            |
| `pnpm test:cross-browser:mobile-android` | Mobile Chrome   | Pixel 7 viewport & touch emulation              |
| `pnpm test:cross-browser:tablet-ipad`    | Tablet WebKit   | iPad Pro 11 viewport                            |
| `pnpm test:cross-browser:desktop-large`  | Large Desktop   | 1920x1080 high-resolution desktop               |
| `pnpm ci:cross-browser`                  | CI execution    | Runs all cross-browser targets inside `xvfb`    |

---

## 🔌 API Testing Suites

Located in `tests/api`. Direct HTTP request integration tests validating API endpoints, payload contracts, status codes, and JSON schemas.

| Script                     | Purpose                  | Notes                                         |
| :------------------------- | :----------------------- | :-------------------------------------------- |
| `pnpm test:api`            | Run full API test suite  | Executes all spec files under `tests/api/`    |
| `pnpm test:api:regression` | Run API regression suite | Skips tests tagged with `@api_nightly`        |
| `pnpm test:api:fake-geo`   | Mock compliance tests    | Executes against local mock compliance server |

---

## ⚡ Grafana k6 Performance Testing

Located in `tests/performance`. High-throughput benchmark suites with tiered tagged SLAs and dual reporting (interactive HTML and time-series Grafana dashboard). See the [Performance Testing Guide](performance-testing-k6.md) for full documentation.

| Script                         | Profile / Scenario   | Duration / VU Target                           |
| :----------------------------- | :------------------- | :--------------------------------------------- |
| `pnpm test:performance`        | Default smoke run    | 1 VU for 30s across all endpoints              |
| `pnpm test:performance:menu`   | **Interactive Menu** | Guided terminal prompt for profile and targets |
| `pnpm test:performance:smoke`  | Smoke Profile        | 1 VU for 30s                                   |
| `pnpm test:performance:load`   | Load Profile         | Ramp to 10 VUs, hold 1m                        |
| `pnpm test:performance:stress` | Stress Profile       | Ramp to 40 VUs                                 |
| `pnpm test:performance:spike`  | Spike Profile        | Burst to 50 VUs                                |
| `pnpm test:performance:soak`   | Soak Profile         | 10 VUs sustained over 5m                       |
| `pnpm test:performance:api`    | API Suite Only       | Focuses solely on `/api/*` endpoints           |
| `pnpm test:performance:web`    | Web Pages Only       | Focuses on SSR page navigation                 |

---

## 🔁 Test Utilities & AI Diagnostics

Located in `scripts/`. Utilities for test maintenance, local blockchain simulation, flakiness verification, and AI failure diagnosis.

| Script                        | Description                                                                               |
| :---------------------------- | :---------------------------------------------------------------------------------------- |
| `pnpm app:fork`               | Launches `aphelion-app` locally against Anvil state fork with pre-funded ETH & tokens     |
| `pnpm test:repeat`            | Interactive utility to execute a test suite multiple times in a loop to detect flakiness  |
| `pnpm agent:triage`           | Diagnoses failed runs, isolates RPC flakiness from regressions, and drafts code diffs     |
| `pnpm agent:heal`             | Reads proposed patches, applies selector updates, and validates fixes in Playwright       |
| `pnpm agent:heal:pr`          | Applies verified self-healing patch, commits to dedicated branch, and opens a GitHub PR   |
| `pnpm agent:impact`           | Analyzes PR git diffs against component dependency graphs to assemble targeted sub-suites |
| `pnpm agent:cleanup-branches` | Scans and prunes stale or merged `ai-heal/*` remote repair branches                       |
| `pnpm agent:crawl`            | Autonomously discovers dynamic pool routes and audits for 404 boundaries (Issue #1649)    |
| `pnpm agent:crawl:all`        | Exhaustively crawls all table pages across products without pagination caps until the end |
| `pnpm test:agent`             | Runs automated unit test suite for AI QA utilities (crawler, impact analyzer, snapshots)  |

### CLI Usage:

```bash
# Triage recent test run failures with AI analysis
pnpm agent:triage

# Automatically apply self-healing locator patches and verify
pnpm agent:heal

# Apply fix, verify, and autonomously open a Pull Request
pnpm agent:heal:pr

# Analyze PR change-impact and resolve targeted test sub-suite
pnpm agent:impact

# Autonomously crawl dynamic liquidity pools and audit for 404 errors (Issue #1649)
pnpm agent:crawl
pnpm agent:crawl --chain=8453
pnpm agent:crawl --scaffold

# Run unit tests for AI agent QA utilities
pnpm test:agent

# Clean up stale or merged ai-heal remote branches (dry run preview)
pnpm agent:cleanup-branches --dry-run

# Launch aphelion-app against Anvil fork (interactive prompt for network and tokens)
pnpm app:fork

# Launch against specific chain and block
pnpm app:fork --chain=8453 --block=21000000

# Pre-fund extra custom tokens with optional whale address
pnpm app:fork --tokens="0xToken:10000"
pnpm app:fork --tokens="0xToken:10000:0xWhaleAddress"

# Run API tests twice
pnpm test:repeat api 2

# Run no-wallet E2E tests 3 times
pnpm test:repeat no-wallet 3

# Run a specific cross-browser project
pnpm test:repeat cross-browser:webkit 1
```

---

## 🛠️ Code Quality & Build

| Script              | Description                                                            |
| :------------------ | :--------------------------------------------------------------------- |
| `pnpm typecheck`    | Validates TypeScript types across the entire codebase (`tsc --noEmit`) |
| `pnpm lint`         | Runs ESLint analysis across TypeScript and JavaScript files            |
| `pnpm lint:fix`     | Automatically fixes ESLint rule violations                             |
| `pnpm format`       | Formats all code and documentation files using Prettier                |
| `pnpm format:check` | Validates code formatting compliance without modifying files           |

---

## 📊 Complete Reference Table

| Script                              | Command                                                           | Purpose                             |
| :---------------------------------- | :---------------------------------------------------------------- | :---------------------------------- |
| `test:no-wallet`                    | `REPORT_FOLDER=no-wallet playwright test --project=no-wallet`     | Run no-wallet E2E suite             |
| `test:no-wallet-regression`         | `playwright test --grep @regression --project=no-wallet`          | Run no-wallet regression tests      |
| `test:with-wallet`                  | `REPORT_FOLDER=with-wallet playwright test --project=with-wallet` | Run with-wallet E2E suite           |
| `test:with-wallet-regression`       | `playwright test --grep @regression --project=with-wallet`        | Run with-wallet regression tests    |
| `test:cross-browser`                | `playwright test --project=firefox --project=webkit ...`          | Run cross-browser smoke matrix      |
| `test:cross-browser:firefox`        | `playwright test --project=firefox`                               | Run Firefox smoke test              |
| `test:cross-browser:webkit`         | `playwright test --project=webkit`                                | Run Safari / WebKit smoke test      |
| `test:cross-browser:mobile-safari`  | `playwright test --project=mobile-safari`                         | Run iPhone 14 emulation             |
| `test:cross-browser:mobile-android` | `playwright test --project=mobile-android`                        | Run Pixel 7 emulation               |
| `test:cross-browser:tablet-ipad`    | `playwright test --project=tablet-ipad`                           | Run iPad Pro emulation              |
| `test:cross-browser:desktop-large`  | `playwright test --project=desktop-large`                         | Run 1080p desktop layout test       |
| `test:api`                          | `REPORT_FOLDER=api-tests playwright test --project=api`           | Run full API test suite             |
| `test:api:regression`               | `playwright test --project=api-regression`                        | Run API regression tests            |
| `test:api:fake-geo`                 | `playwright test --project=api-fake-geo`                          | Run API tests with mock geo server  |
| `test:performance`                  | `k6 run -c k6.config.json ... tests/performance/main.perf.ts`     | Run k6 performance suite            |
| `test:performance:menu`             | `node scripts/run-performance.js`                                 | Interactive performance test runner |
| `test:performance:smoke`            | `K6_PROFILE=smoke pnpm test:performance`                          | Run k6 smoke profile                |
| `test:performance:load`             | `K6_PROFILE=load pnpm test:performance`                           | Run k6 load profile                 |
| `test:performance:stress`           | `K6_PROFILE=stress pnpm test:performance`                         | Run k6 stress profile               |
| `test:performance:spike`            | `K6_PROFILE=spike pnpm test:performance`                          | Run k6 spike profile                |
| `test:performance:soak`             | `K6_PROFILE=soak pnpm test:performance`                           | Run k6 soak profile                 |
| `test:performance:api`              | `K6_SCENARIO=api pnpm test:performance`                           | Run k6 API target scenario          |
| `test:performance:web`              | `K6_SCENARIO=web pnpm test:performance`                           | Run k6 Web target scenario          |
| `test:repeat`                       | `node scripts/repeat-tests.js`                                    | Interactive test repeater utility   |
| `agent:triage`                      | `node scripts/qa-agent/triage-agent.js`                           | AI failure diagnosis & diff reports |
| `agent:heal`                        | `node scripts/qa-agent/heal-agent.js`                             | Apply self-healing patches & verify |
| `agent:heal:pr`                     | `node scripts/qa-agent/heal-agent.js --create-pr`                 | Apply fix, verify, & open GitHub PR |
| `agent:impact`                      | `node scripts/qa-agent/pr-impact-analyzer.js`                     | PR impact analyzer & test selector  |
| `agent:cleanup-branches`            | `node scripts/qa-agent/cleanup-branches.js`                       | Prune stale/merged ai-heal branches |
| `agent:crawl`                       | `node scripts/qa-agent/crawl-vaults.js`                           | Dynamic route crawler & 404 auditor |
| `test:agent`                        | `node scripts/qa-agent/...test.js`                                | Run AI agent test suites            |
| `app:fork`                          | `node scripts/run-app-fork.js`                                    | Run local dApp with Anvil fork      |
| `rpc:gateway`                       | `node scripts/local-rpc-gateway.js`                               | Run local RPC gateway proxy         |
| `test:local-node`                   | `docker compose -f docker-compose.test.yml up ...`                | Run containerized Anvil + API tests |
| `synpress-build-cache:base`         | `pnpm synpress ./utils/synpress/wallet-setup`                     | Build local Synpress wallet cache   |
| `ci:synpress-build-cache:base`      | `xvfb-run pnpm synpress-build-cache:base`                         | Build Synpress cache in CI          |
| `ci:no-wallet`                      | `WORKERS='2' xvfb-run pnpm test:no-wallet`                        | Run no-wallet suite in CI           |
| `ci:no-wallet-regression`           | `WORKERS='2' xvfb-run pnpm test:no-wallet-regression`             | Run no-wallet regression in CI      |
| `ci:cross-browser`                  | `xvfb-run pnpm test:cross-browser`                                | Run cross-browser suite in CI       |
| `ci:with-wallet`                    | `WORKERS='1' xvfb-run pnpm test:with-wallet`                      | Run with-wallet suite in CI         |
| `ci:with-wallet-regression`         | `WORKERS='1' xvfb-run pnpm test:with-wallet-regression`           | Run with-wallet regression in CI    |
| `typecheck`                         | `tsc --noEmit`                                                    | Validate TypeScript types           |
| `lint`                              | `eslint .`                                                        | Lint codebase with ESLint           |
| `lint:fix`                          | `eslint . --fix`                                                  | Autofix linting violations          |
| `format`                            | `prettier --write .`                                              | Format files with Prettier          |
| `format:check`                      | `prettier --check .`                                              | Verify Prettier formatting          |
