# Full Local Stack E2E Testing

End-to-end tests that run every layer of Supersmooth for real, locally, with no hosted services:

| Layer      | What runs                                                                      |
| :--------- | :----------------------------------------------------------------------------- |
| Chain      | Anvil mainnet fork at the latest block (archive reads via Alchemy)             |
| Contracts  | A fresh `core-v1` deployment on that fork (`Deploy.s.sol`)                     |
| Indexer    | Postgres + Redis + Ponder, following the fork in real time                     |
| App        | `aphelion-app` dev server (`pnpm dev-app`) pointed at the fork and the indexer |
| App DB     | A `sovereign_app` database in the stack's Postgres, with the app's migrations  |
| Swap quote | Real 0x API quotes (the only external call besides the fork RPC)               |

The open-position test opens a Multiply position from the vault page, lands on the new
position's page, and finds it in the portfolio. It runs once per scenario, one per supported
protocol, all on Ethereum: Aave v3 with WETH (`E2E-PROTO-006`), Spark with WETH (`E2E-PROTO-008`)
and Aave's Lido market with wstETH (`E2E-PROTO-009`). It is the flow the Anvil worker suite cannot cover
([#73](https://github.com/Aphelion-Co/sov-e2e-tests/issues/73)): it needs real swap quotes, the
contract deployment and the indexer.

## Quick start

```bash
pnpm test:fullstack          # up -> run the suite -> down (about 8 to 10 minutes cold)
pnpm test:fullstack:keep     # same, but leave the stack running afterwards
pnpm fullstack:up            # only bring the stack up
pnpm test:fullstack:only     # run the suite against a stack that is already up (about 1 minute)
pnpm fullstack:status        # show what is running
pnpm fullstack:down          # stop everything and restore aphelion-app's files
```

Extra Playwright arguments go after `--`, e.g. `pnpm test:fullstack -- --headed`.

## Prerequisites

- Docker Desktop with **Compose v2.24+** (the app's compose files use `!reset` / `!override`)
- Foundry (`cast`), pnpm, Node 20+
- An `aphelion-app` checkout with dependencies installed; its path in `sov-e2e-tests/.env`:
  `APHELION_APP_DIR=/path/to/aphelion-app`
- An Alchemy key for the fork, which needs an archive-capable RPC (free public RPCs rate-limit or
  refuse archive reads). Preferably a **dedicated** one in `sov-e2e-tests/.env`:
  `E2E_ALCHEMY_KEY=…` (see [Alchemy usage](#alchemy-usage-and-rate-limits)). Without it the runner
  falls back to `ALCHEMY_KEY` in `aphelion-app/.env` and prints a note.
- In `aphelion-app/.env`: `ZEROX_API_KEY`. Without a swap quote the "Open Position" button never
  enables (a free key from the 0x dashboard is enough)
- Ports 3000, 18545 and 42169 free (stop any other `pnpm dev-app` first)
- No uncommitted changes in `aphelion-app/packages/sovereign-sdk/src` or
  `dev-infra/deploy-config/deploy.1.json`: the runner rewrites them and restores them afterwards,
  so it refuses to start rather than mix your edits with generated ones

The runner never prints keys. It does not touch the shared `sovereign-anvil` / `dev-infra`
containers.

## How the runner works

`scripts/fullstack/run.js` reuses the app team's isolated e2e stack (`aphelion-app/dev-infra/e2e`,
compose project `keeper-loop-e2e`) instead of a copy of it, so infra changes on the app side are
picked up automatically.

`up`:

1. Preflight: Compose version, required keys present, clean SDK paths, free ports
2. Records what it is about to change in `.temp/fullstack/state.json` (so `down` can undo it,
   even after a crash)
3. Starts Anvil, runs the deployer and saves the deployment manifest
4. Starts Postgres and Redis, creates the app database `sovereign_app` in that Postgres and runs
   the app's migrations (`packages/sovereign-db/scripts/migrate-up.mjs`) on it
5. Starts Ponder; waits for `/ready`, mines a block and checks Ponder follows it
6. Stages the SDK with the new contract addresses (the app team's
   `e2e_stage_sdk_deployment` helper) and rebuilds it
7. Starts `pnpm dev-app --env-mode=loose` against the fork and the app database (log:
   `.temp/fullstack/app.log`), warms up the pages, and refuses to report the stack ready unless
   the app holds a connection to `sovereign_app` (see [App database](#app-database)), then fills
   the product table for `E2E_PRODUCT_TABLE_PROTOCOLS` (default `aaveV3,spark,aaveV3Lido`)

`down` reverses every step: stops the app process group, `docker compose down -v`, restores the SDK
from its backup, and removes generated files that did not exist before.

`test` reuses a stack that is already up, and only tears down a stack it started itself.
`Ctrl+C` also tears down.

`scripts/fullstack/docker-compose.fullstack.override.yml` gives the indexer container its own
`node_modules` volumes. Without it, the host's macOS `node_modules` is mounted into the Linux
container and Rollup's native binary is missing. It also wires the Anvil container's Alchemy key
and throttling, described next.

## Alchemy usage and rate limits

Every run forks the **latest** block with an empty cache (a stale fork makes live 0x quotes
revert), so Anvil fetches every storage slot it touches from Alchemy: the deployment, Ponder's
backfill, and the app's reads. One run is thousands of upstream requests, in bursts.

Two measures keep that in check:

- **Dedicated key.** `E2E_ALCHEMY_KEY` (in `sov-e2e-tests/.env`) is given only to this stack's
  Anvil, through compose `environment:`, which wins over the shared `env_file`. Your own dev fork
  (`sovereign-anvil`) reads `ALCHEMY_KEY` from `aphelion-app/.env` once it is recreated, so with a
  shared key, test bursts would slow it down (and the other way round). Create a second app in the
  Alchemy dashboard for it.
- **Throttling.** Anvil assumes 330 compute units per second (a paid plan). The override puts
  `scripts/fullstack/anvil-throttled.sh` first on the container's `PATH` as `anvil`: it adds
  `--compute-units-per-second` (default 100, `E2E_ANVIL_CUPS` to change), `--retries 10` and
  `--fork-retry-backoff 1000` when anvil forks, so excess requests queue in Anvil instead of
  getting 429s. The app team's entrypoint script runs unchanged.

Symptoms of hitting the limit: Alchemy's "rate limit" email, `upstream 127.0.0.1:18545 failed:
The operation was aborted due to timeout` in `.temp/fullstack/app.log`, and slow or failed cold
runs. Lower `E2E_ANVIL_CUPS`, or raise the plan's throughput in the dashboard.

## App database

Opening a position writes to the app's own database (not the indexer's): accepting the Terms of
Service stores a `terms_acceptances` row and a `wallet_screenings` row (and a `wallet_attribution`
row when the visit came through a `?ref=` / `utm_*` link). Vault pages also read their market from
the `products_*` tables, which the app's product-table cron fills; the runner runs that update once
per protocol in `E2E_PRODUCT_TABLE_PROTOCOLS` (default `aaveV3,spark,aaveV3Lido`; `PATCH /api/product-table`, about
a minute each, mainnet rows read from the fork; the update also refreshes the protocol's rows on
other chains through the app's own RPCs for them). The stack
gives the app its own database so all of this stays local and can be asserted.

Two things had to change for the app to use it:

- **Turbo env mode.** `pnpm dev-app` runs through turbo, whose default strict mode passes only the
  variables `turbo.json` declares. `DATABASE_URL` is not one of them, so it was dropped, and the
  app's `dotenv -e ../../.env` then loaded the hosted database from `aphelion-app/.env`. The runner
  passes `--env-mode=loose`; dotenv never overrides a variable that is already set.
- **Caller environment.** Loose mode passes the caller's whole environment. The runner drops
  coding-agent session variables (`CLAUDE*`, `ANTHROPIC_*`, `AI_AGENT`, …): the app has no use
  for them, some carry session tokens, and `next dev` stops with an upgrade prompt when it sees
  them.

The guard after warm-up checks `/api/terms/status` reports `enforced: true` (the app has a
database) and that `pg_stat_activity` shows a connection to `sovereign_app`. If either fails, the
run stops before any test writes anywhere else. `FULLSTACK_APP_DB_URL` points the tests at the
database (default `postgres://ponder:ponder@127.0.0.1:15432/sovereign_app`).

## Test design

### Isolation: a fresh account per test, never a rewind

The Anvil worker suite isolates tests with `evm_snapshot` / `evm_revert`. That does not work here:
the indexer cannot follow a chain that is rewound under it. Instead, the `wallet` fixture generates
a new private key per test, gives it gas money (`anvil_setBalance`) and impersonates it; the test
then funds exactly the collateral it deposits (`wallet.fund`: WETH is wrapped, any other token is
transferred from a holder the protocol adapter names).
Each account owns its own Safe and positions, so tests cannot see each other's state, even in
parallel on the same chain. One stack per run, torn down afterwards.

### Convergence instead of sleeps

The chain, the indexer and the app are separate processes, so each assertion waits for its layer
(`utils/fullStack.ts`):

1. **Chain**: every transaction the app broadcast is mined with receipt status `0x1`
   (the `app` fixture records each `eth_sendTransaction` hash)
2. **Indexer**: Ponder's `/status` has reached the highest of those blocks
3. **UI**: Playwright's auto-waiting assertions on the page

### What is real and what is mocked

Real: the wallet signatures (viem, through the EIP-1193 bridge), the Terms of Service signature
verified by the app server and stored in the app database, the swap quote, every transaction, the
indexer, the position page, the portfolio.

Mocked: only the browser's calls to `/api/compliance/geo` and `/api/compliance/screen`, which call
third-party screening services that are not part of the stack under test. The server-side
screening on terms acceptance is not mocked; with no provider configured it records the
"unavailable" marker (`sanctioned` null), which the test accepts.

### Choosing the vault

The test does not hardcode a market. `pickOpenableVault` (`utils/protocols`) asks the app, through
`getActiveVault`, for the most liquid Multiply vault matching the scenario's protocol, network and
collateral; on this stack the app's product table is filled from the fork, so the ranking reflects
the fork's state. Each candidate must also pass the protocol adapter's on-chain check (for the Aave
v3 family, through the pool's own data provider and oracle) before it is used:

- both reserves active, not frozen, not paused; collateral usable, borrowing enabled
- at least $50,000 available to borrow, and as much room under the borrow and supply caps

A rejected candidate moves on to the next one. The report shows the chosen vault as a `vault`
annotation and each rejection as `vault skipped`, so failures stay comparable between runs. The
on-chain assertions read the position through the same adapter (for Aave: the market's aToken and
variable debt token, the debt priced with its oracle), so they work for whichever market was
chosen.

### Code structure, and adding scenarios

The spec reads as the flow; the mechanics live in reusable objects, so a new scenario is a row of
data rather than a new test:

| Where                                      | What                                                                                                                        |
| :----------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------- |
| `tests/e2e/fullstack/openPosition.spec.ts` | `SCENARIOS`: one row per protocol / network / collateral / deposit, each with its test case ID; one test body runs them all |
| `src/stack` (`stack` fixture)              | Checks for the layers below the UI: `stack.appDb`, `stack.chain`, `stack.indexer`, each with `should…` methods and `@step`s |
| `src/pages` (`app` fixture)                | UI checks: `positionPage.shouldMatchPosition`, `portfolioPage.openPageShouldUseIndexer`, …                                  |
| `utils/protocols`                          | `ProtocolAdapter` per protocol (market, capacity problems, position, token holder) and `pickOpenableVault`                  |
| `src/fixtures/fullStack.ts`                | Fresh `wallet` per test (`wallet.fund`), `app`, `stack`                                                                     |

To add a scenario:

- **Same protocol, another collateral:** add a row to `SCENARIOS` and a test case
- **Another deployment of the Aave v3 contracts:** add `aaveV3FamilyAdapter('<slug>')` to
  `PROTOCOLS`, a row, and the slug in `E2E_PRODUCT_TABLE_PROTOCOLS` (the Spark and Lido rows are
  examples)
- **Another protocol** (Morpho, Compound, …): implement `ProtocolAdapter` next to
  `aaveV3Family.ts`, register it in `PROTOCOLS`, then as above
- **Another network:** not yet; the stack forks Ethereum only (`run.js`, the indexer config and the
  `stack` fixture's chain check would need a fork per chain). Scenarios already carry `network`

### Assertions in `openPosition.spec.ts`

- Vault choice: the first candidate that passes the on-chain check above
- Success screen "… position opened!" with an enabled "Go to position" button
- App database: exactly one terms acceptance for the wallet, with signature and nonce; at least
  one screening, none sanctioned; no attribution row (the visit was not through a tagged link)
- Every sent transaction succeeded on chain; the indexer reached the last block
- The position URL ends in the new Safe address, and that Safe is owned by the test wallet
- On chain, the Safe holds more than 1 collateral aToken for a 1 WETH deposit, and owes variable
  debt
- The position page's total exposure and debt (priced with Aave's oracle) match the chain within
  1%, and the multiple is > 1
- Ponder's latest snapshot for the Safe is the `open`, with a net value above zero; the portfolio
  API sources the position from the indexer (not its on-chain fallback), and the card's Net Value
  matches the snapshot within $1 (it shows whole dollars)

## Troubleshooting

| Symptom                                                                                                   | Cause / fix                                                                                                                                                                                                                                                                                             |
| :-------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| "Open Position" stays disabled                                                                            | No swap quote: check `ZEROX_API_KEY`; `/api/swap-quote` returns 503 without a working provider                                                                                                                                                                                                          |
| Fork fails to start, 429 or "archive requests" errors                                                     | Set `E2E_ALCHEMY_KEY` (or `ALCHEMY_KEY`); public RPCs cannot serve the fork                                                                                                                                                                                                                             |
| Alchemy "rate limit" email, RPC timeouts in app.log                                                       | See [Alchemy usage](#alchemy-usage-and-rate-limits): dedicated key, lower `E2E_ANVIL_CUPS`                                                                                                                                                                                                              |
| `!reset` / `!override` parse errors                                                                       | Compose is older than v2.24: update Docker Desktop                                                                                                                                                                                                                                                      |
| Indexer exits with `@rollup/rollup-linux-*` missing                                                       | The override file was not applied; run through `run.js`, not plain `docker compose`                                                                                                                                                                                                                     |
| `No mainnet fork at …` in the test                                                                        | The stack is not up: `pnpm fullstack:up`, or use `pnpm test:fullstack`                                                                                                                                                                                                                                  |
| Slow "Enabling Smart Account…" or position page on a fresh fork                                           | Anvil's state cache is cold, so reads through the app can time out (`upstream 127.0.0.1:18545 failed` in app.log). The app retries; the spec waits up to 150 s for the open and reloads the position page (up to 3 min). A warm fork is fast                                                            |
| `open retried` annotation, or "Transaction failed: a step inside your account reverted (Safe code GS013)" | The swap quote comes from live 0x routing, but executes on the fork; when the route does not hold against the fork's state the app simulates the step, sends nothing and offers Retry. The spec clicks Retry (at most twice), which takes a fresh quote. A third revert fails the test with the message |
| `aphelion-app/.env` has `PORT=` empty                                                                     | The runner always sets `PORT=3000`; if the app dies on start, the runner fails at once and points to `.temp/fullstack/app.log`                                                                                                                                                                          |
| "aphelion-app is not using the stack's app database"                                                      | The app ignored `DATABASE_URL`: check `pnpm dev-app` still runs through turbo with `--env-mode=loose`, and `.temp/fullstack/app.log`                                                                                                                                                                    |
| App exits after a Next.js "upgrade recommendation"                                                        | `next dev` saw coding-agent variables; the runner strips them, so a new agent's variable may need adding to `AGENT_ENV` in `run.js`                                                                                                                                                                     |
| App hangs at "Compiling /"                                                                                | Start it through `pnpm dev-app` (the runner does), not `next dev` directly                                                                                                                                                                                                                              |
| Runner refuses: SDK paths not clean                                                                       | Commit or stash your changes in `packages/sovereign-sdk/src` / `deploy.1.json`                                                                                                                                                                                                                          |

A failed run keeps a Playwright trace (`trace: 'retain-on-failure'`) in the report folder
`fullstack`. The app's output is in `.temp/fullstack/app.log`.

## CI

`.github/workflows/reusable-fullstack-tests.yml` runs the suite on a GitHub-hosted runner
(`ubuntu-24.04`, Docker Compose on the runner itself). It checks out both repositories, writes
aphelion-app's `.env` from a secret, runs `run.js test --keep`, then always collects the stack's
logs and tears it down. `fullstack-tests.yml` runs it by hand (Actions → Full-stack E2E Tests),
and the Nightly Run (`nightly.yml`, Mon and Thu 01:00 UTC) runs it with 2 workers. The nightly job
is skipped, not failed, while the two required secrets are missing.

Call it from any workflow, in this repository or another one:

```yaml
jobs:
  fullstack:
    uses: Aphelion-Co/sov-e2e-tests/.github/workflows/reusable-fullstack-tests.yml@main
    secrets: inherit
    with:
      aphelionAppRef: staging # optional
```

Within this repository, `uses: ./.github/workflows/reusable-fullstack-tests.yml` works too.

**Secrets**

| Secret                  | Required | What it is                                                                                                                                                                                                                                                             |
| ----------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APHELION_STATUS_TOKEN` | yes      | Fine-grained token with Contents: read on `Aphelion-Co/aphelion-app` (the same secret the Anvil suite uses). Called from another repository, it also needs read access to `sov-e2e-tests`                                                                              |
| `APHELION_APP_ENV`      | yes      | Contents of aphelion-app's root `.env` for CI. Must have `ZEROX_API_KEY` (swap quotes), and `ALCHEMY_KEY` unless `E2E_ALCHEMY_KEY` is set. Use a CI-only file with test or restricted keys. Its `DATABASE_URL` is never used: the app runs on the stack's own database |
| `E2E_ALCHEMY_KEY`       | no       | Dedicated Alchemy key for the fork, so test bursts do not eat into the shared `ALCHEMY_KEY` rate limit. Lower `anvilCups` if it is on a free plan                                                                                                                      |
| `GEMINI_API_KEY`        | no       | AI triage of failures (as in the other suites)                                                                                                                                                                                                                         |
| `DISCORD_WEBHOOK_URL`   | no       | Where the triage posts                                                                                                                                                                                                                                                 |

`secrets: inherit` passes them all when the caller has them. Otherwise pass them one by one under
`secrets:`. Without the two required ones, a first job fails the run with the names of the missing
secrets, or skips the suite with a notice when `skipWithoutSecrets: true`.

**Inputs** (all optional)

| Input                   | Default                   | Use                                                                                      |
| ----------------------- | ------------------------- | ---------------------------------------------------------------------------------------- |
| `aphelionAppRef`        | calling commit / default  | The app version to test. Called from aphelion-app, it defaults to the calling commit     |
| `e2eTestsRef`           | calling commit / default  | The tests version. Called from this repository, it defaults to the calling commit        |
| `playwrightArgs`        | —                         | E.g. `--grep E2E-PROTO-006` to run one scenario                                          |
| `productTableProtocols` | `aaveV3,spark,aaveV3Lido` | Product tables the stack fills; one per protocol the scenarios open                      |
| `anvilCups`             | `100`                     | Alchemy compute units per second for the fork                                            |
| `workers`               | `1`                       | Scenarios one after another. More runs them in parallel on the same stack (not verified) |
| `retries`               | `1`                       | Each retry opens a new position with a new wallet                                        |
| `timeoutMinutes`        | `60`                      | Job timeout                                                                              |
| `skipWithoutSecrets`    | `false`                   | Skip the suite instead of failing when a required secret is missing                      |

**Artifacts:** `fullstack-report` (HTML report), `fullstack-debug` (traces, screenshots, the app's
log, every container's log) and `results-json-fullstack` (metrics).

Only one stack fits on a runner (fixed container names and ports), so run one job per runner; do
not use a matrix that puts two in the same job.
