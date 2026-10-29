# 🚀 Grafana k6 Performance Testing Guide

This directory houses the automated performance testing suite powered by **[Grafana k6](https://k6.io/)** and **TypeScript**.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Prerequisites & Installation](#prerequisites--installation)
- [Directory Structure](#directory-structure)
- [Workload Profiles](#workload-profiles)
- [Test Scenarios](#test-scenarios)
- [Running Performance Tests](#running-performance-tests)
- [Customizing Runs (Flags & Environment Variables)](#customizing-runs-flags--environment-variables)
- [Metrics, SLAs & Thresholds](#metrics-slas--thresholds)
- [Reports & Artifacts](#reports--artifacts)
- [GitHub Actions CI/CD](#github-actions-cicd)

---

## 🔍 Overview

The performance testing suite allows engineering and QA teams to:

- Benchmark API endpoint response times and throughput.
- Validate web page load performance.
- Enforce strict SLA thresholds (e.g. 95th percentile latency < 1000ms, error rate < 1%).
- Execute standardized traffic profiles (smoke, average load, stress, spike, and soak tests).
- Generate self-contained, interactive HTML reports with metrics and checks.

---

## 🛠️ Prerequisites & Installation

Performance tests require the `k6` CLI tool installed locally.

### macOS (Homebrew)

```bash
brew install k6
```

### Linux (Debian / Ubuntu)

```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

### Windows (winget)

```bash
winget install k6 --source winget
```

### Docker

```bash
docker run --rm -i grafana/k6 run - <tests/performance/main.perf.ts
```

Verify your installation:

```bash
k6 version
```

---

## 📁 Directory Structure

```
tests/performance/
├── config/
│   ├── environments.ts    # Target URLs, base headers, test addresses
│   ├── profiles.ts        # Traffic profiles (smoke, load, stress, spike, soak)
│   ├── stages.ts          # Granular stage definitions for load/stress/spike/soak
│   └── thresholds.ts      # Reusable SLA pass/fail thresholds & tiered SLAs
├── scenarios/
│   ├── api/
│   │   ├── compliance.perf.ts   # Geo compliance & wallet screening
│   │   ├── portfolio.perf.ts    # User safes, portfolio summary, terms status
│   │   ├── products.perf.ts     # Product top cards, effective spread, migrations
│   │   ├── rpc.perf.ts          # JSON-RPC endpoint (eth_blockNumber)
│   │   └── tokenPrices.perf.ts  # Token prices (default & coin-filtered)
│   └── web/
│       └── pageNavigation.perf.ts # Page loads (/, /products/earn, /products/borrow, /products/trade, /products/multiply, /migrate)
├── reporter.ts            # Native HTML summary & historical comparison table generator
└── main.perf.ts           # Central entrypoint orchestrating full test suites

scripts/
└── run-performance.js     # Zero-dependency interactive CLI runner with menu prompts
```

---

## 📊 Workload Profiles

Configured in `tests/performance/config/profiles.ts`:

| Profile      | Purpose                                           | Stages / Pattern                                                              | Default Thresholds                        |
| :----------- | :------------------------------------------------ | :---------------------------------------------------------------------------- | :---------------------------------------- |
| **`smoke`**  | Sanity check to verify endpoints and test scripts | 1 VU for 30s                                                                  | `p(95) < 1.2s`, `err < 1%`                |
| **`load`**   | Normal expected traffic simulation                | Ramp 10 VUs (20s) -> Hold 10 VUs (1m) -> Ramp down (15s)                      | `p(90) < 600ms`, `p(95) < 1s`, `err < 1%` |
| **`stress`** | Pushing system towards capacity limits            | Ramp 20 VUs (30s) -> Hold (1m) -> Ramp 40 VUs (30s) -> Hold (1m) -> Ramp down | `p(95) < 2.5s`, `err < 5%`                |
| **`spike`**  | Simulating sudden traffic surges                  | Ramp 50 VUs (10s) -> Hold (30s) -> Ramp down (10s)                            | `p(95) < 2.5s`, `err < 5%`                |
| **`soak`**   | Endurance run to catch memory leaks & degradation | Ramp 10 VUs (30s) -> Hold 10 VUs (5m) -> Ramp down                            | `p(90) < 600ms`, `p(95) < 1s`, `err < 1%` |

---

## 🎯 Test Scenarios

| Scenario              | Target                      | Description                                                                                          |
| :-------------------- | :-------------------------- | :--------------------------------------------------------------------------------------------------- |
| **`all`** _(default)_ | Full end-to-end user flow   | Visits web pages, checks token prices, tables, compliance, portfolio, and RPC                        |
| **`api`**             | All API endpoints           | Runs token prices, compliance, products, portfolio, and RPC in sequence                              |
| **`web`**             | Web pages                   | Loads `/`, `/products/earn`, `/products/borrow`, `/products/trade`, `/products/multiply`, `/migrate` |
| **`tokens`**          | `/api/token-prices/current` | Benchmarks default query and multi-coin queries                                                      |
| **`compliance`**      | `/api/compliance/*`         | Benchmarks `/geo` (GET) and `/screen` (POST)                                                         |
| **`portfolio`**       | `/api/portfolio/*`          | Benchmarks `/safes`, `/summary`, `/recommended-strategies`, `/terms/status`                          |
| **`products`**        | Product APIs                | Benchmarks `/api/product-table/top-cards`, `/api/effective-spread`, `/api/migrate/*`                 |
| **`rpc`**             | `/api/rpc/:chainId`         | Benchmarks JSON-RPC calls (`eth_blockNumber` e.g. Base chain `8453`)                                 |

> [!NOTE]
> `/api/compliance/screen` executes sanctions screening against external compliance providers. In staging or non-production environments, high-concurrency workloads (`stress` or `spike`) may encounter upstream rate limits. It is recommended to use `smoke` or `load` when targeting compliance scenarios directly.

---

## 🚀 Running Performance Tests

### Using pnpm Scripts (Recommended)

All `pnpm` scripts execute native `k6 run` commands directly using `k6.config.json`. Target settings in `.env` are parsed natively by k6, and reports are exported automatically without requiring Node wrapper scripts.

```bash
# Interactive menu (prompts for profile, targets & options):
pnpm test:performance:menu

# Run default smoke test (all scenarios, 1 VU, 30s)
pnpm test:performance

# Run by profile:
pnpm test:performance:smoke
pnpm test:performance:load
pnpm test:performance:stress
pnpm test:performance:spike
pnpm test:performance:soak

# Run by scenario:
pnpm test:performance:api
pnpm test:performance:web

# Run a specific single endpoint or page:
TARGET=earn pnpm test:performance:smoke
TARGET=token-prices pnpm test:performance:smoke
TARGET=rpc pnpm test:performance:smoke

# Run multiple specific endpoints/pages (comma-separated):
TARGET="earn,borrow" pnpm test:performance:smoke
TARGET="earn,token-prices,rpc" pnpm test:performance:smoke
TARGET="/earn, /api/token-prices/current" pnpm test:performance
```

### Supported Target Identifiers

You can pass friendly names or exact URL paths to `TARGET` (or `K6_TARGET`):

| Category               | Available Target Identifiers                                                                  |
| :--------------------- | :-------------------------------------------------------------------------------------------- |
| **Web Pages**          | `earn`, `borrow`, `trade`, `multiply`, `migrate`, `home` (or `/products/earn`, `/earn`, etc.) |
| **Token Prices**       | `tokens`, `token-prices`, `/api/token-prices/current`                                         |
| **Compliance**         | `compliance` (both), `geo` (`/api/compliance/geo`), `screen` (`/api/compliance/screen`)       |
| **Portfolio**          | `portfolio` (all), `safes`, `summary`, `strategies`, `terms`                                  |
| **Products & Migrate** | `products` (all), `top-cards`, `spread`, `migrate-earn`, `migrate-safes`                      |
| **RPC**                | `rpc`, `/api/rpc`, `/api/rpc/8453`                                                            |
| **Suites**             | `all`, `api`, `web`                                                                           |

### Running Specific Scenario Files Directly

You can pass any specific test file or forward flags directly:

```bash
# Run an individual scenario directly with k6:
k6 run -c k6.config.json tests/performance/scenarios/api/tokenPrices.perf.ts
```

---

## ⚙️ Customizing Runs (Flags & Environment Variables)

You can override runtime parameters easily via CLI flags or `.env`:

### CLI Overrides

```bash
# Run load profile with custom VUs and duration:
K6_VUS=5 K6_DURATION=45s pnpm test:performance

# Choose profile and scenario via environment variables:
K6_PROFILE=load K6_SCENARIO=tokens pnpm test:performance

# Target a different environment:
K6_BASE_URL="https://prod.supersmooth.fi" pnpm test:performance:smoke
```

### Environment Variables (`.env`)

```ini
# Target environment
K6_BASE_URL=https://staging.supersmooth.fi

# Profile selection: smoke | load | stress | spike | soak
K6_PROFILE=load

# Scenario selection: all | api | web | tokens | compliance | portfolio | products | rpc
K6_SCENARIO=api

# Target specific endpoints/pages (comma-separated or single)
K6_TARGET=earn,borrow

# Quick manual overrides
K6_VUS=10
K6_DURATION=1m
```

---

## 📈 Metrics, SLAs & Thresholds

During test execution, k6 continuously evaluates global thresholds as well as granular tagged SLAs:

### Global Baseline Thresholds

- **`http_req_duration`**: Response time percentiles (`avg`, `min`, `med`, `p90`, `p95 < 1500ms`, `p99 < 3000ms`, `max`).
- **`http_req_failed`**: Ratio of failed requests (`rate < 0.01`).
- **`http_reqs`**: Total completed HTTP transactions and throughput rate.
- **`checks`**: Validation check rate (`rate > 0.99`).

### Tiered Tagged SLAs

To prevent false negatives across differing workload types (e.g., heavy SSR web pages vs. fast cached API endpoints), requests are tagged with `type` and evaluated against targeted SLA tiers:

| Target Type          | Tag Selector      | Target SLA (p95) | Covered Endpoints / Scenarios                                                                                    |
| :------------------- | :---------------- | :--------------- | :--------------------------------------------------------------------------------------------------------------- |
| **Fast APIs**        | `{type:api_fast}` | `< 500ms`        | High-frequency lightweight cached queries (`/api/token-prices/*`, `/api/compliance/*`)                           |
| **Aggregation APIs** | `{type:api_agg}`  | `< 1200ms`       | Multi-source aggregation endpoints (`/api/portfolio/*`, `/api/product-table/top-cards`, `/api/effective-spread`) |
| **RPC Relays**       | `{type:rpc}`      | `< 1800ms`       | Blockchain node relays / JSON-RPC (`/api/rpc/:chainId`)                                                          |
| **Web Pages**        | `{type:web}`      | `< 2000ms`       | Server-rendered frontend pages and documents (`/`, `/products/*`, `/migrate`)                                    |

If any active threshold fails, k6 exits with non-zero exit code `99`, signaling a failure to CI/CD.

---

## 📑 Reports & Artifacts

Every test execution automatically generates reports inside `performance-reports/` using **Grafana k6's native reporting engine**:

1. **Terminal Summary**: Itemised checks, SLA evaluations, and key metrics printed directly to stdout with pass/fail indicators.
2. **Itemised Checks & Spec Report** (`performance-reports/report.html`):
   - Standalone HTML report generated via k6's native `handleSummary` hook.
   - Contains an itemised table of all page and API checks (e.g. `page / returned 200`, `token prices response has prices object`) with passes/fails counts and success rate percentages.
   - Includes KPI summary cards, SLA threshold evaluations, and HTTP latency percentile breakdowns.
3. **Official Grafana HTML Dashboard** (`performance-reports/dashboard.html`):
   - Standalone, interactive HTML report generated automatically via k6's native `web-dashboard` export.
   - Full time-series graphs for active VUs, requests per second, latency percentiles, and errors over the test timeline.
4. **Execution History & Comparison Table** (`performance-reports/history/`):
   - Every execution is automatically timestamped and archived (e.g. `history/report-2026-10-29_13-30-00_smoke_all.html`).
   - The primary `report.html` renders a **Recent Runs History & Comparison** table at the bottom comparing the last 20 runs side-by-side with execution date, profile, targets, request throughput, p95 latency, check pass rates, and direct links to historical reports.
   - Automatically maintains the last 20 runs in `history/runs.json` with self-pruning.
5. **Native JSON Summary** (`performance-reports/summary.json`):
   - Exported directly via native `handleSummary` for programmatic CI/CD consumption and metric trend tracking.
6. **Live Web Dashboard** (`http://127.0.0.1:5665`):
   - Real-time interactive web dashboard while running locally.

---

## 🤖 GitHub Actions CI/CD

Performance tests can be triggered manually or integrated into deployment pipelines:

- **Workflow:** `.github/workflows/performance-tests.yml`
- **Reusable Workflow:** `.github/workflows/reusable-performance-tests.yml`

### Manual Dispatch (Workflow Dispatch)

1. Go to **Actions** in GitHub.
2. Select **Performance Tests**.
3. Choose the **Base URL**, **Profile** (`smoke`, `load`, `stress`, `spike`, `soak`), **Scenario**, and optional **Target(s)** (e.g. `earn,borrow` or `tokens,rpc`).
4. Click **Run workflow**.
5. Once completed, download the **`performance-reports`** artifact containing the HTML and JSON reports.
