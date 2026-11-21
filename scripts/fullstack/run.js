#!/usr/bin/env node
/* global fetch, AbortSignal -- Node 20+ built-ins */

/**
 * scripts/fullstack/run.js
 *
 * Full-stack local E2E runner: brings up an ISOLATED copy of the whole Supersmooth stack, runs the
 * `fullstack` Playwright project against it, and tears everything down again.
 *
 * Stack (all local, nothing shared or hosted is touched):
 *   - Anvil mainnet fork at the latest block (archive reads through Alchemy, throttled)
 *   - A fresh core-v1 contract deployment on that fork
 *   - Postgres + Redis + the Ponder indexer, following the fork in real time
 *   - aphelion-app (Next.js dev server) pointed at the fork and the indexer
 *
 * It reuses aphelion-app's own isolated e2e stack (dev-infra/e2e, compose project
 * `keeper-loop-e2e`) instead of a copy of it, so infra changes on the app side are picked up.
 *
 * Usage:
 *   node scripts/fullstack/run.js test [--keep] [-- <playwright args>]
 *       up (unless already up) -> run the suite -> down (unless --keep or it was already up)
 *   node scripts/fullstack/run.js up      bring the stack + app up and leave them running
 *   node scripts/fullstack/run.js down    stop everything and restore aphelion-app's files
 *   node scripts/fullstack/run.js status  show what is running
 *
 * Requires (see docs/fullstack-e2e-testing.md):
 *   - Docker with Compose v2.24+, Foundry (`cast`), pnpm, an aphelion-app checkout (APHELION_APP_DIR)
 *   - E2E_ALCHEMY_KEY in sov-e2e-tests/.env (or ALCHEMY_KEY in aphelion-app/.env): archive fork RPC
 *   - ZEROX_API_KEY in aphelion-app/.env: swap quotes
 */

import { spawn, spawnSync } from 'node:child_process';
import console from 'node:console';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(ROOT, '.env'), quiet: true });

const OVERRIDE_FILE = path.join(ROOT, 'scripts/fullstack/docker-compose.fullstack.override.yml');
const STATE_DIR = path.join(ROOT, '.temp/fullstack');
const STATE_FILE = path.join(STATE_DIR, 'state.json');
const APP_LOG = path.join(STATE_DIR, 'app.log');

// Matches the app team's harness: container names in docker-compose.e2e.yml are fixed, so this
// stack and `run-*-keeper-loop-e2e.sh` cannot run at the same time anyway.
const PROJECT = 'keeper-loop-e2e';
const ANVIL_PORT = Number(process.env.E2E_ANVIL_PORT || 18545);
const PONDER_PORT = Number(process.env.E2E_PONDER_PORT || 42169);
const APP_PORT = 3000; // aphelion-app's dev script hardcodes `next dev --port 3000`
const RPC_URL = `http://127.0.0.1:${ANVIL_PORT}`;
const PONDER_URL = `http://127.0.0.1:${PONDER_PORT}`;
const APP_URL = `http://localhost:${APP_PORT}`;
// The app's own database, in this stack's Postgres (credentials from aphelion-app's compose file)
const DB_PORT = Number(process.env.E2E_DB_PORT || 15432);
const APP_DB_NAME = 'sovereign_app';
// Protocols whose vaults the specs open (utils/protocols): their product table rows must exist
const PRODUCT_TABLE_PROTOCOLS = (
  process.env.E2E_PRODUCT_TABLE_PROTOCOLS || 'aaveV3,spark,aaveV3Lido'
)
  .split(',')
  .map((protocol) => protocol.trim())
  .filter(Boolean);
const APP_DB_URL = `postgres://ponder:ponder@127.0.0.1:${DB_PORT}/${APP_DB_NAME}`;

const RUNTIME_MANIFEST = 'packages/core-v1/logs/e2e/deploy.1.fork.json';
const SDK_TRACKED_PATHS = ['packages/sovereign-sdk/src', 'dev-infra/deploy-config/deploy.1.json'];
const PONDER_GENERATED = ['apps/ponder/generated/schema.graphql', 'apps/ponder/ponder-env.d.ts'];
const NEXT_AGENTS_MD = 'apps/sovereign-app/AGENTS.md';
const WARM_UP_PATHS = [
  '/',
  '/products/multiply/aaveV3/1/0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2-0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2-0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
];

// -----------------------------------------------------------------------------
// Small helpers
// -----------------------------------------------------------------------------
const log = (msg) => console.log(`[fullstack ${new Date().toISOString().slice(11, 19)}] ${msg}`);
const fail = (msg) => {
  console.error(`\n[fullstack] ERROR: ${msg}\n`);
  process.exit(1);
};

function resolveAppDir() {
  const raw = process.env.APHELION_APP_DIR;
  if (!raw)
    fail('APHELION_APP_DIR is not set in sov-e2e-tests/.env (path to the aphelion-app checkout).');
  const dir = raw.startsWith('~') ? path.join(os.homedir(), raw.slice(1)) : path.resolve(raw);
  if (!fs.existsSync(path.join(dir, 'dev-infra/e2e/docker-compose.e2e.yml'))) {
    fail(`${dir} does not look like an aphelion-app checkout (dev-infra/e2e is missing).`);
  }
  return dir;
}

const APP_DIR = resolveAppDir();
const appEnvFile = path.join(APP_DIR, '.env');
const APP_ENV = fs.existsSync(appEnvFile) ? dotenv.parse(fs.readFileSync(appEnvFile)) : {};

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function writeState(state) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/** Runs a command; throws with its output on a non-zero exit. */
function run(cmd, args, { cwd = APP_DIR, quiet = false, env = process.env } = {}) {
  const res = spawnSync(cmd, args, {
    cwd,
    env,
    encoding: 'utf8',
    stdio: quiet ? 'pipe' : 'inherit',
  });
  if (res.status !== 0) {
    const detail = quiet ? `\n${res.stdout ?? ''}${res.stderr ?? ''}` : '';
    throw new Error(`${cmd} ${args.join(' ')} exited with ${res.status}${detail}`);
  }
  return (res.stdout ?? '').trim();
}

/**
 * Alchemy key for this stack's fork. A dedicated E2E_ALCHEMY_KEY (sov-e2e-tests/.env) keeps test
 * bursts off the quota of the developer's own fork, which reads ALCHEMY_KEY from the same
 * aphelion-app/.env. Falls back to that shared key.
 */
const forkAlchemyKey = () => process.env.E2E_ALCHEMY_KEY || APP_ENV.ALCHEMY_KEY || '';

/** Variables docker-compose.fullstack.override.yml interpolates. */
const composeEnv = () => ({
  ...process.env,
  FULLSTACK_ALCHEMY_KEY: forkAlchemyKey(),
  // Alchemy compute units per second Anvil may spend upstream. Anvil assumes 330 (a paid plan);
  // above the plan's real limit, cold-cache bursts get 429s and the app's RPC reads time out.
  FULLSTACK_ANVIL_CUPS: process.env.E2E_ANVIL_CUPS || '100',
  FULLSTACK_SCRIPTS_DIR: path.join(ROOT, 'scripts/fullstack'),
});

const compose = (args, opts) =>
  run(
    'docker',
    [
      'compose',
      '--env-file',
      '.env',
      '-f',
      'dev-infra/docker-compose.yml',
      '-f',
      'dev-infra/e2e/docker-compose.e2e.yml',
      '-f',
      OVERRIDE_FILE,
      '-p',
      PROJECT,
      ...args,
    ],
    { env: composeEnv(), ...opts },
  );

async function jsonRpc(method, params = []) {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(30_000),
  });
  const json = await res.json();
  if (json.error) throw new Error(`${method}: ${json.error.message}`);
  return json.result;
}

async function httpStatus(url, timeoutMs = 10_000) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return res.status;
  } catch {
    return 0;
  }
}

async function waitFor(what, check, { timeoutMs, intervalMs = 3_000 }) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await sleep(intervalMs);
  }
  throw new Error(`Timed out after ${Math.round(timeoutMs / 1000)}s waiting for ${what}`);
}

/**
 * Proves the app reads and writes THIS stack's app database before any test runs: makes it query
 * the database once, then checks this stack's Postgres sees the app connected to it. The app has
 * a single DATABASE_URL, so a connection here means it is not talking to any other database.
 */
async function assertAppUsesLocalDatabase() {
  const probe = `0x${'0'.repeat(39)}1`;
  const res = await fetch(`${APP_URL}/api/terms/status?address=${probe}`, {
    signal: AbortSignal.timeout(60_000),
  });
  const status = await res.json().catch(() => ({}));
  const connections = Number(
    compose(
      [
        'exec',
        '-T',
        'db',
        'psql',
        '-U',
        'ponder',
        '-d',
        'ponder',
        '-tAc',
        `SELECT count(*) FROM pg_stat_activity WHERE datname = '${APP_DB_NAME}'`,
      ],
      { quiet: true },
    ),
  );
  if (!res.ok || status.enforced !== true || connections < 1) {
    throw new Error(
      `aphelion-app is not using the stack's app database (terms status ${res.status}, ` +
        `enforced=${status.enforced}, connections to ${APP_DB_NAME}: ${connections}). ` +
        'Refusing to run tests that could write to another database.',
    );
  }
  log(`      app uses the local ${APP_DB_NAME} database`);
}

/**
 * Fills the app database's product tables. A vault page 404s unless its market has a row in
 * `products_*`, which the app's product-table cron normally writes. This runs the same update the
 * cron does (`PATCH /api/product-table`), through the app, so mainnet rows are read from the fork.
 * Only the protocols the suite trades on (`PRODUCT_TABLE_PROTOCOLS`): about a minute each on a
 * cold fork.
 */
async function seedProductTable(protocol) {
  const secret = APP_ENV.PRODUCT_TABLE_UPDATE_SECRET;
  const res = await fetch(`${APP_URL}/api/product-table?protocol=${protocol}`, {
    method: 'PATCH',
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
    signal: AbortSignal.timeout(10 * 60_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success !== true) {
    throw new Error(
      `Product table update for ${protocol} failed (HTTP ${res.status}, ` +
        `failed tasks: ${body.failedCount ?? '?'}), see ${path.relative(ROOT, APP_LOG)}`,
    );
  }
  log(`      ${protocol} product rows written: ${body.updatedCount}`);
}

async function ponderHead() {
  try {
    const res = await fetch(`${PONDER_URL}/status`, { signal: AbortSignal.timeout(5_000) });
    const status = await res.json();
    return Number(Object.values(status)[0]?.block?.number ?? 0);
  } catch {
    return 0;
  }
}

const gitIsClean = (paths) =>
  run('git', ['status', '--porcelain', '--', ...paths], { quiet: true }).length === 0;

// -----------------------------------------------------------------------------
// Preflight
// -----------------------------------------------------------------------------
function preflight() {
  const version = run('docker', ['compose', 'version', '--short'], { quiet: true });
  const [major, minor] = version.replace(/^v/, '').split('.').map(Number);
  if (major < 2 || (major === 2 && minor < 24)) {
    fail(
      `Docker Compose ${version} is too old: aphelion-app's e2e stack needs v2.24+ (!override tags).`,
    );
  }
  if (!forkAlchemyKey()) {
    fail(
      'No Alchemy key: set E2E_ALCHEMY_KEY in sov-e2e-tests/.env (or ALCHEMY_KEY in aphelion-app/.env). ' +
        'The fork needs an archive-capable RPC: free public endpoints rate-limit (429) or refuse ' +
        'archive reads once the fork block is ~128 blocks old.',
    );
  }
  if (!process.env.E2E_ALCHEMY_KEY) {
    log(
      'Note: E2E_ALCHEMY_KEY is not set, so the fork uses ALCHEMY_KEY from aphelion-app/.env and ' +
        'shares its rate limit with your dev fork. A separate key avoids that (see the guide).',
    );
  }
  if (!APP_ENV.ZEROX_API_KEY) {
    fail(
      'ZEROX_API_KEY is empty in aphelion-app/.env. Without a swap quote the Multiply flow never ' +
        'enables "Open Position" (sov-e2e-tests#73).',
    );
  }
  if (!gitIsClean(SDK_TRACKED_PATHS)) {
    fail(
      `aphelion-app has local changes under ${SDK_TRACKED_PATHS.join(', ')}. The run regenerates ` +
        'those files for the fork deployment and restores them afterwards, so it refuses to touch ' +
        'uncommitted work there. Commit or stash it first.',
    );
  }
}

// -----------------------------------------------------------------------------
// up / down
// -----------------------------------------------------------------------------
async function up() {
  const existing = readState();
  if (existing)
    fail(
      'A full stack is already up (or a previous run did not clean up). Run `pnpm fullstack:down` first.',
    );
  for (const port of [APP_PORT, ANVIL_PORT, PONDER_PORT]) {
    if ((await httpStatus(`http://127.0.0.1:${port}`, 2_000)) !== 0) {
      fail(
        `Port ${port} is already in use. Stop whatever is listening there (e.g. \`pnpm app:fork\`).`,
      );
    }
  }
  preflight();

  // Written before anything changes, so `down` can always undo exactly what this run did.
  const state = {
    startedAt: new Date().toISOString(),
    appDir: APP_DIR,
    agentsMdExisted: fs.existsSync(path.join(APP_DIR, NEXT_AGENTS_MD)),
    ponderGeneratedWasClean: gitIsClean(PONDER_GENERATED),
    sdkBackupDir: null,
    appPid: null,
    forkBlock: null,
  };
  writeState(state);

  for (const dir of ['broadcast', 'cache', 'out', 'logs/e2e']) {
    fs.mkdirSync(path.join(APP_DIR, 'packages/core-v1', dir), { recursive: true });
  }
  run('chmod', [
    '-R',
    'a+rwX',
    ...['broadcast', 'cache', 'out', 'logs'].map((d) => `packages/core-v1/${d}`),
  ]);
  run('docker', ['volume', 'create', 'anvil-fork-cache'], { quiet: true });
  run(
    'docker',
    ['run', '--rm', '-v', 'anvil-fork-cache:/c', 'alpine', 'chown', '-R', '1000:1000', '/c'],
    {
      quiet: true,
    },
  );

  log('[1/6] Anvil fork (latest mainnet block)');
  compose(['up', '-d', 'anvil']);
  await waitFor('Anvil', async () => !!(await jsonRpc('eth_blockNumber').catch(() => null)), {
    timeoutMs: 120_000,
    intervalMs: 2_000,
  });
  state.forkBlock = Number(await jsonRpc('eth_blockNumber'));
  writeState(state);
  log(`      forked at block ${state.forkBlock}`);

  log('[2/6] Deploy core-v1 contracts (first run compiles Solidity: ~10-15 min)');
  compose(['up', '-d', '--no-deps', 'deployer']);
  await waitFor(
    'the deployer to finish',
    async () =>
      compose(['ps', '-a', 'deployer', '--format', '{{.State}}'], { quiet: true }) === 'exited',
    { timeoutMs: 40 * 60_000, intervalMs: 5_000 },
  );
  if (compose(['ps', '-a', 'deployer', '--format', '{{.ExitCode}}'], { quiet: true }) !== '0') {
    throw new Error('Contract deployment failed: see `docker logs keeper-e2e-deployer`.');
  }
  const deployerLog = compose(['logs', 'deployer', '--no-color', '--no-log-prefix'], {
    quiet: true,
  });
  const blocks = deployerLog.split('===CQQ22_DEPLOY_JSON_BEGIN===').slice(1);
  const manifest = blocks.at(-1)?.split('===CQQ22_DEPLOY_JSON_END===')[0]?.trim();
  if (!manifest || JSON.parse(manifest).chainId !== 1) {
    throw new Error('Deploy manifest not found in the deployer logs.');
  }
  fs.writeFileSync(path.join(APP_DIR, RUNTIME_MANIFEST), `${manifest}\n`);

  log('[3/6] Postgres + Redis, and a migrated app database');
  compose(['up', '-d', '--no-deps', '--wait', 'db', 'redis']);
  // The app's own database (terms acceptances, screenings, Safe requests, ...) lives next to
  // Ponder's in this stack's Postgres, so a run never touches a shared or hosted one. It goes
  // away with the stack (`down -v`).
  compose(
    [
      'exec',
      '-T',
      'db',
      'psql',
      '-U',
      'ponder',
      '-d',
      'ponder',
      '-c',
      `CREATE DATABASE ${APP_DB_NAME}`,
    ],
    {
      quiet: true,
    },
  );
  run('node', ['scripts/migrate-up.mjs'], {
    cwd: path.join(APP_DIR, 'packages/sovereign-db'),
    quiet: true,
    // SKIP_GENERATE_TYPES: the migration would otherwise regenerate tracked type files
    env: {
      ...process.env,
      DATABASE_URL: `${APP_DB_URL}?sslmode=disable`,
      SKIP_GENERATE_TYPES: '1',
    },
  });
  log(`      app database ${APP_DB_NAME} migrated`);

  log('[4/6] Ponder indexer');
  compose(['up', '-d', '--no-deps', '--build', '--renew-anon-volumes', 'indexer']);
  await waitFor('ponder /ready', async () => (await httpStatus(`${PONDER_URL}/ready`)) === 200, {
    timeoutMs: 15 * 60_000,
    intervalMs: 5_000,
  });
  // /ready only proves backfill: prove realtime indexing by mining one block and watching it land
  const before = await ponderHead();
  await jsonRpc('evm_mine');
  await waitFor('ponder to index a newly mined block', async () => (await ponderHead()) > before, {
    timeoutMs: 90_000,
    intervalMs: 2_000,
  });
  log('      indexer follows new blocks');

  log('[5/6] Point the app SDK at the fresh deployment (restored by `down`)');
  state.sdkBackupDir = run(
    'bash',
    [
      '-c',
      'set -euo pipefail; source dev-infra/e2e/keeper-loop-e2e-helpers.sh; ' +
        'e2e_stage_sdk_deployment "$1" >&2; echo "$E2E_SDK_STAGE_BACKUP_DIR"',
      '_',
      RUNTIME_MANIFEST,
    ],
    { quiet: true },
  );
  writeState(state);
  run('pnpm', ['--filter', '@sovereign/sdk', 'build'], { quiet: true });

  log(`[6/6] aphelion-app on ${APP_URL} (log: ${path.relative(ROOT, APP_LOG)})`);
  const logFd = fs.openSync(APP_LOG, 'w');
  // --env-mode=loose: turbo's default strict mode only passes the variables turbo.json declares,
  // and DATABASE_URL is not one of them for `dev`. It was dropped, and `dotenv -e ../../.env` in
  // the app's dev script then loaded the hosted database from aphelion-app/.env. In loose mode our
  // value reaches the app, and dotenv never overrides a variable that is already set.
  // Loose mode also passes the caller's whole environment, so drop what strict mode used to filter
  // and the app has no use for: coding-agent session variables (some carry session tokens), which
  // also make `next dev` stop with an "upgrade" prompt meant for the agent instead of serving.
  const AGENT_ENV = /^(CLAUDE|ANTHROPIC_|AI_AGENT$|CURSOR_|CODEX_)/;
  const callerEnv = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !AGENT_ENV.test(name)),
  );
  const app = spawn('pnpm', ['dev-app', '--env-mode=loose'], {
    cwd: APP_DIR,
    detached: true, // own process group, so `down` can stop turbo, next and the SDK watchers together
    stdio: ['ignore', logFd, logFd],
    env: {
      ...callerEnv,
      ...APP_ENV,
      // aphelion-app/.env may hold an empty `PORT=`, which `next dev` rejects even with --port
      PORT: String(APP_PORT),
      NEXT_PUBLIC_LOCAL_FORK: 'true',
      NEXT_PUBLIC_DEFAULT_CHAIN_ID: '1',
      IS_FORK: 'true',
      CHAIN_ID: '1',
      ETH_RPC_URL: RPC_URL,
      PRODUCT_TABLE_ETH_RPC_URL: RPC_URL,
      FOUNDRY_RPC_URL: RPC_URL,
      ANVIL_RPC_URL: RPC_URL,
      NEXT_PUBLIC_ANVIL_URL: RPC_URL,
      PONDER_URL,
      NEXT_PUBLIC_SITE_URL: APP_URL,
      FEE_SESSION_ALLOWED_ORIGIN: `${APP_URL},http://127.0.0.1:${APP_PORT}`,
      // This stack's own app database, never the one in aphelion-app/.env (see --env-mode above)
      DATABASE_URL: APP_DB_URL,
    },
  });
  // Fail fast if the dev server dies, instead of waiting out the warm-up timeout
  let appExit = null;
  app.on('exit', (code, signal) => (appExit = signal ?? `exit code ${code}`));
  app.unref();
  state.appPid = app.pid;
  writeState(state);

  // First request per route compiles it (20s+ on a cold dev server): warm the pages the suite uses
  for (const route of WARM_UP_PATHS) {
    await waitFor(
      `${APP_URL}${route}`,
      async () => {
        if (appExit) {
          throw new Error(`aphelion-app stopped (${appExit}), see ${path.relative(ROOT, APP_LOG)}`);
        }
        return (await httpStatus(`${APP_URL}${route}`, 300_000)) === 200;
      },
      {
        timeoutMs: 10 * 60_000,
      },
    );
  }
  await assertAppUsesLocalDatabase();
  for (const protocol of PRODUCT_TABLE_PROTOCOLS) await seedProductTable(protocol);
  log('Stack ready');
}

async function down() {
  const state = readState();
  if (!state) {
    log('Nothing to stop (no state file).');
    return;
  }
  // The checkout `up` changed, even if APHELION_APP_DIR points elsewhere now
  const appDir = state.appDir || APP_DIR;

  if (state.appPid) {
    try {
      process.kill(-state.appPid, 'SIGTERM');
      log('app stopped');
    } catch {
      // already gone
    }
  }

  log('Removing the stack containers and volumes');
  try {
    compose(['down', '-v', '--remove-orphans'], { quiet: true, cwd: appDir });
  } catch (error) {
    console.error(String(error));
  }

  let restored = true;
  if (state.sdkBackupDir) {
    try {
      run(
        'bash',
        [
          '-c',
          'source dev-infra/e2e/keeper-loop-e2e-helpers.sh; E2E_SDK_STAGE_BACKUP_DIR="$1"; e2e_restore_sdk_deployment',
          '_',
          state.sdkBackupDir,
        ],
        { quiet: true, cwd: appDir },
      );
      log('SDK files restored');
    } catch (error) {
      restored = false;
      console.error(`SDK restore failed; the backup is kept at ${state.sdkBackupDir}\n${error}`);
    }
  }
  // Each step runs even if an earlier one failed; a failure keeps the state file for a retry
  const restoreStep = (name, fn) => {
    try {
      fn();
    } catch (error) {
      restored = false;
      console.error(`${name} failed:\n${error}`);
    }
  };
  if (state.ponderGeneratedWasClean) {
    restoreStep('Restoring the Ponder generated files', () =>
      run('git', ['checkout', '--', ...PONDER_GENERATED], { quiet: true, cwd: appDir }),
    );
  }
  if (!state.agentsMdExisted) {
    restoreStep(`Removing ${NEXT_AGENTS_MD}`, () =>
      fs.rmSync(path.join(appDir, NEXT_AGENTS_MD), { force: true }),
    );
  }
  restoreStep(`Removing ${RUNTIME_MANIFEST}`, () =>
    fs.rmSync(path.join(appDir, RUNTIME_MANIFEST), { force: true }),
  );

  if (restored) fs.rmSync(STATE_FILE, { force: true });
  log(restored ? 'Down: aphelion-app restored' : 'Down, but see the errors above');
}

async function status() {
  const state = readState();
  console.log({
    state: state ?? 'not up',
    anvil: await jsonRpc('eth_blockNumber')
      .then(Number)
      .catch(() => 'down'),
    ponderHead: (await ponderHead()) || 'down',
    app: (await httpStatus(APP_URL, 5_000)) || 'down',
  });
}

/**
 * A state file only says a stack was started: a failed `up` keeps it on purpose (for debugging and
 * `down`). Reuse the stack only if every service answers, so tests never run against a dead one.
 */
async function assertStackHealthy() {
  const [block, head, app] = await Promise.all([
    jsonRpc('eth_blockNumber').catch(() => null),
    ponderHead().catch(() => null),
    httpStatus(APP_URL, 10_000).catch(() => null),
  ]);
  const dead = [!block && 'Anvil', !head && 'Ponder', !app && 'the app'].filter(Boolean);
  if (dead.length) {
    fail(
      `A stack state file exists but ${dead.join(', ')} did not respond: a previous run did not ` +
        'finish starting or cleaning up. Run `pnpm fullstack:down`, then try again.',
    );
  }
}

async function test(argv) {
  const keep = argv.includes('--keep');
  const passthrough = argv.includes('--') ? argv.slice(argv.indexOf('--') + 1) : [];
  const alreadyUp = !!readState();
  if (alreadyUp) await assertStackHealthy();

  let cleaningUp = false;
  const cleanupAndExit = async (code) => {
    if (cleaningUp) return;
    cleaningUp = true;
    try {
      if (!alreadyUp && !keep) await down();
    } catch (error) {
      // Teardown problems are reported, but never change the tests' result
      console.error(`\n[fullstack] Teardown failed: ${error.message ?? error}`);
    } finally {
      process.exit(code);
    }
  };
  process.on('SIGINT', () => void cleanupAndExit(130));
  process.on('SIGTERM', () => void cleanupAndExit(143));

  let exitCode = 1;
  try {
    if (alreadyUp) log('Reusing the stack that is already up');
    else await up();
    const res = spawnSync(
      'pnpm',
      ['exec', 'playwright', 'test', '--project=fullstack', ...passthrough],
      {
        cwd: ROOT,
        stdio: 'inherit',
        env: { ...process.env, REPORT_FOLDER: 'fullstack' },
      },
    );
    exitCode = res.status ?? 1;
  } catch (error) {
    console.error(`\n[fullstack] ${error.message ?? error}`);
  }
  if (keep && !alreadyUp) log('--keep: stack left running. Stop it with `pnpm fullstack:down`.');
  await cleanupAndExit(exitCode);
}

// -----------------------------------------------------------------------------
const [command = 'test', ...rest] = process.argv.slice(2);
const commands = { up, down, status, test: () => test(rest) };
if (!commands[command]) fail(`Unknown command "${command}". Use: test | up | down | status`);
try {
  await commands[command]();
} catch (error) {
  console.error(`\n[fullstack] ${error.message ?? error}`);
  if (command === 'up')
    console.error('Partial stack left up for debugging: run `pnpm fullstack:down`.');
  process.exit(1);
}
