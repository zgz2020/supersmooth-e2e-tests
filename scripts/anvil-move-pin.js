#!/usr/bin/env node
/**
 * Moves the Anvil fork pin (`utils/constants/forkBlocks.json`) and checks the new pin works.
 *
 *   pnpm anvil:move-pin                  pin to the upstream RPC's latest finalized block
 *   pnpm anvil:move-pin --block=<n>      pin to block <n>, after checking it exists, is
 *                                        finalized and the upstream RPCs still serve its state
 *   pnpm anvil:move-pin --chain=<id>     chain to move (default: ANVIL_FORK_CHAIN, else 1)
 *   pnpm anvil:move-pin --verify         don't move: check `pnpm app:fork` runs on the pin and
 *                                        the upstream RPCs serve it, fill Anvil's state cache
 *                                        with one warm-up suite run (ANVIL_CACHE_WARMUP=1, one
 *                                        worker), then run the suite with --repeat-each 3
 *
 * Typical flow: move the pin, restart `pnpm app:fork`, run `--verify`, then open a PR with
 * `forkBlocks.json` alone. See docs/anvil-fork-playwright-testing.md#pinned-fork-block.
 */
import { spawn } from 'node:child_process';
import console from 'node:console';
import fs from 'node:fs';
import process from 'node:process';
import { pathToFileURL, URL } from 'node:url';
import dotenv from 'dotenv';
import {
  checkNewPin,
  FORK_BLOCKS_FILE,
  FORK_UPSTREAM_RPCS,
  parseBlockNumber,
  servesStateAt,
} from '../utils/constants/fork.js';

dotenv.config({ quiet: true });

const APP_FORK_RPC = 'http://127.0.0.1:8545';

/** Reads `forkBlocks.json` fresh (not the copy cached at import), so it can be rewritten. */
function readPins() {
  return JSON.parse(fs.readFileSync(FORK_BLOCKS_FILE, 'utf8'));
}

function writePins(pins) {
  const sorted = Object.fromEntries(Object.entries(pins).sort(([a], [b]) => Number(a) - Number(b)));
  fs.writeFileSync(FORK_BLOCKS_FILE, `${JSON.stringify(sorted, null, 2)}\n`);
}

async function rpc(url, method, params = [], timeoutMs = 15_000) {
  const response = await globalThis.fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: globalThis.AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`${method}: HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(`${method}: ${body.error.message || JSON.stringify(body.error)}`);
  return body.result;
}

const toHex = (n) => `0x${n.toString(16)}`;

/** The upstream RPCs the fixture and `app:fork` fork from, in the order they try them. */
function upstreamCandidates(chainId) {
  return process.env.ANVIL_FORK_URL ? [process.env.ANVIL_FORK_URL] : FORK_UPSTREAM_RPCS[chainId];
}

/**
 * Checks every upstream RPC serves state at `block`, as the fixture and `app:fork` may fall back
 * to any of them. Fails when none does; lists the ones that don't (they get skipped).
 */
async function checkUpstreamsServe(chainId, block) {
  const candidates = upstreamCandidates(chainId);
  const results = await Promise.all(candidates.map((url) => servesStateAt(url, block)));
  const serving = candidates.filter((_, i) => results[i]);
  for (const [i, url] of candidates.entries()) {
    console.log(
      `  ${results[i] ? '✅' : '⚠️ '} ${url}${results[i] ? '' : ': no state at this block (skipped by the fixture and app:fork)'}`,
    );
  }
  if (serving.length === 0) {
    throw new Error(
      `No upstream RPC serves state at block ${block}: pick a more recent block, or set ANVIL_FORK_URL to an archive RPC.`,
    );
  }
}

/** The first upstream RPC that answers, with its latest finalized block. */
async function findUpstream(chainId) {
  const candidates = upstreamCandidates(chainId);
  const errors = [];
  for (const url of candidates) {
    try {
      const block = await rpc(url, 'eth_getBlockByNumber', ['finalized', false]);
      return { url, finalized: Number(block.number) };
    } catch (err) {
      errors.push(`${url}: ${err.message}`);
    }
  }
  throw new Error(`No upstream RPC answered for chain ${chainId}:\n  ${errors.join('\n  ')}`);
}

function parseArgs(argv) {
  const args = { verify: false };
  for (const arg of argv) {
    if (arg.startsWith('--block=')) args.block = arg.slice('--block='.length).trim();
    else if (arg.startsWith('--chain=')) args.chain = arg.slice('--chain='.length).trim();
    else if (arg === '--verify') args.verify = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Unknown option: ${arg} (see --help)`);
  }
  return args;
}

async function movePin(chainId, requested) {
  const pins = readPins();
  const current = pins[String(chainId)] ?? null;

  const { url, finalized } = await findUpstream(chainId);
  const block = requested ? parseBlockNumber(requested) : finalized;
  console.log(`Upstream: ${url}`);
  console.log(`Current pin: ${current ?? 'none (forks latest)'} · latest finalized: ${finalized}`);

  const { error, warnings } = checkNewPin({ block, finalized, current });
  if (error) throw new Error(error);

  // The block must exist, and its state must still be served upstream (old blocks need archive)
  const header = await rpc(url, 'eth_getBlockByNumber', [toHex(block), false]);
  if (!header) throw new Error(`Block ${block} was not found on chain ${chainId}.`);
  console.log(`Upstream RPCs serving state at block ${block}:`);
  await checkUpstreamsServe(chainId, block);

  for (const warning of warnings) console.warn(`⚠️  ${warning}`);
  pins[String(chainId)] = block;
  writePins(pins);

  const ageHours = (Date.now() / 1000 - Number(header.timestamp)) / 3600;
  console.log(
    `✅ Pinned chain ${chainId} to block ${block} (${ageHours.toFixed(1)} h old) in utils/constants/forkBlocks.json`,
  );
  console.log(`
Next:
  1. Restart \`pnpm app:fork\` so the app server forks the new block.
  2. pnpm anvil:move-pin --verify   (fills Anvil's cache, then --repeat-each 3)
  3. Open a PR with forkBlocks.json alone.`);
}

function runSuite(chainId, extraArgs, extraEnv = {}) {
  return new Promise((resolve) => {
    const child = spawn('pnpm', ['exec', 'playwright', 'test', '--project=anvil', ...extraArgs], {
      stdio: 'inherit',
      env: {
        ...process.env,
        ANVIL_FORK_CHAIN: String(chainId),
        REPORT_FOLDER: 'anvil-move-pin',
        ...extraEnv,
      },
    });
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

async function verifyPin(chainId) {
  const pin = readPins()[String(chainId)];
  if (!pin) throw new Error(`Chain ${chainId} has no pin in utils/constants/forkBlocks.json.`);
  if (process.env.ANVIL_FORK_BLOCK?.trim()) {
    throw new Error(
      `ANVIL_FORK_BLOCK=${process.env.ANVIL_FORK_BLOCK} overrides the pin; unset it (also in .env) to verify the pin.`,
    );
  }

  let appForkBlock;
  try {
    appForkBlock = (await rpc(APP_FORK_RPC, 'anvil_nodeInfo', [], 3_000))?.forkConfig
      ?.forkBlockNumber;
  } catch {
    throw new Error(
      `No Anvil on ${APP_FORK_RPC}: start \`pnpm app:fork --chain=${chainId}\` first.`,
    );
  }
  if (appForkBlock !== pin) {
    throw new Error(
      `pnpm app:fork forks block ${appForkBlock}, not the pin ${pin}: restart it so the app server and the tests use the same block.`,
    );
  }
  console.log(`✅ pnpm app:fork runs on the pin (${pin}).`);

  // An old pin can fall out of what an RPC serves: uncached reads would then fail, not just be slow
  console.log(`Upstream RPCs serving state at block ${pin}:`);
  await checkUpstreamsServe(chainId, pin);

  console.log(`\n1/2 Filling Anvil's state cache for block ${pin} (one suite run, may be slow)...`);
  // Warm-up mode: no revert after each test, so what the tests fetch reaches the disk cache.
  // One worker: Anvils that exit at the same moment overwrite each other's cache writes.
  const warmCode = await runSuite(chainId, [], { ANVIL_CACHE_WARMUP: '1', WORKERS: '1' });
  console.log(
    warmCode === 0
      ? 'Cache run passed.'
      : 'Cache run had failures (expected: cold fetches, and its tests share state); checking stability next.',
  );

  console.log('\n2/2 Stability run (--repeat-each 3)...');
  const code = await runSuite(chainId, ['--repeat-each', '3']);
  if (code !== 0) {
    throw new Error(`The suite is not stable on block ${pin}: see the report above.`);
  }
  console.log(`\n✅ Block ${pin} is stable: the suite passed 3 times on a warm cache.`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    const header = fs.readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0];
    console.log(
      header
        .split('\n')
        .filter((line) => line.startsWith(' *'))
        .map((line) => line.replace(/^ \* ?/, ''))
        .join('\n'),
    );
    return;
  }
  const chainId = Number(args.chain || process.env.ANVIL_FORK_CHAIN || 1);
  if (!FORK_UPSTREAM_RPCS[chainId]) {
    throw new Error(
      `Unsupported chain ${chainId}: use one of ${Object.keys(FORK_UPSTREAM_RPCS).join(', ')}.`,
    );
  }
  if (args.verify) {
    if (args.block) throw new Error('--verify checks the current pin; it takes no --block.');
    await verifyPin(chainId);
  } else {
    await movePin(chainId, args.block);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  });
}
