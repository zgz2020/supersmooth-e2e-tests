#!/usr/bin/env node
/**
 * Posts the monthly Anvil fork pin reminder to Discord (`DISCORD_WEBHOOK_URL`): the pinned block
 * per chain, how old it is, and the steps to check or move it. Run by
 * `.github/workflows/anvil-pin-reminder.yml` on the 1st of each month.
 *
 *   node scripts/anvil-pin-reminder.js             post the reminder
 *   node scripts/anvil-pin-reminder.js --dry-run   print it instead
 *
 * The block age is read from the chain's upstream RPCs. If none answers, the reminder is still
 * posted, without the age.
 */
import console from 'node:console';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { FORK_UPSTREAM_RPCS, PINNED_FORK_BLOCKS } from '../utils/constants/fork.js';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Pin age limit: a pin is flagged at the reminder closest to it, or once past it. */
export const PIN_MAX_AGE_DAYS = 30;
/** How long to wait for Discord before failing the job with a clear error. */
const DISCORD_TIMEOUT_MS = 30_000;
const DOCS_PATH = 'docs/anvil-fork-playwright-testing.md#pinned-fork-block';

/** The timestamp (ms) of `block`, from the first of `rpcs` that answers, or null. */
export async function blockTimeMs(rpcs, block, fetchImpl = globalThis.fetch, timeoutMs = 10_000) {
  for (const url of rpcs) {
    try {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getBlockByNumber',
          params: [`0x${block.toString(16)}`, false],
        }),
        signal: globalThis.AbortSignal.timeout(timeoutMs),
      });
      const timestamp = (await res.json())?.result?.timestamp;
      if (timestamp) return Number.parseInt(timestamp, 16) * 1000;
    } catch {
      // try the next RPC
    }
  }
  return null;
}

/** When the next reminder runs: the 1st of the month after `now`, 08:00 UTC (the workflow cron). */
export function nextReminderMs(now) {
  const date = new Date(now);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 8);
}

/**
 * The reminder text. `pins` maps chain id to block, `blockTimes` maps chain id to the block's
 * timestamp in ms (or null when unknown), `docsUrl` links the procedure.
 */
export function pinReminderMessage({ pins, blockTimes, now, docsUrl }) {
  const lines = ['🗓️ **Monthly Anvil fork pin check** (owner: QA Engineer)', ''];
  for (const [chain, block] of Object.entries(pins)) {
    const time = blockTimes[chain];
    if (time == null) {
      lines.push(`• Chain ${chain}: block ${block} (age unknown, no RPC answered)`);
      continue;
    }
    const days = Math.floor((now - time) / DAY_MS);
    const date = new Date(time).toISOString().slice(0, 10);
    // Reminders are 28-31 days apart, so waiting for "over the limit" could flag a pin only at
    // about twice the limit. Flag it at the reminder closest to the limit instead: now, if it is
    // nearer the limit today than it will be past it at the next reminder
    const next = nextReminderMs(now);
    const daysAtNext = Math.floor((next - time) / DAY_MS);
    let due = '';
    if (days > PIN_MAX_AGE_DAYS) due = ' ⚠️ due for a move';
    else if (daysAtNext - PIN_MAX_AGE_DAYS > PIN_MAX_AGE_DAYS - days) {
      const nextDate = new Date(next).toISOString().slice(0, 10);
      due = ` ⚠️ due for a move (${daysAtNext} days old by the next check on ${nextDate})`;
    }
    lines.push(`• Chain ${chain}: block ${block}, from ${date} (${days} days old)${due}`);
  }
  lines.push(
    '',
    `Move the pin when it's flagged (about ${PIN_MAX_AGE_DAYS} days old) or a test needs a newer vault or contract:`,
    '1. `pnpm anvil:move-pin`',
    '2. restart `pnpm app:fork`',
    '3. `pnpm anvil:move-pin --verify` (warm-up run, then `--repeat-each 3`, must pass)',
    '4. open a PR with `utils/constants/forkBlocks.json` alone',
    '',
    'Not moving it? Still run `pnpm anvil:move-pin --verify` to check the pin works.',
    `Procedure and what may break after a move: ${docsUrl}`,
  );
  return lines.join('\n');
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!dryRun && !webhook) {
    console.error('DISCORD_WEBHOOK_URL is not set.');
    process.exit(1);
  }

  const blockTimes = {};
  for (const [chain, block] of Object.entries(PINNED_FORK_BLOCKS)) {
    blockTimes[chain] = await blockTimeMs(FORK_UPSTREAM_RPCS[chain] ?? [], block);
  }
  const repo = process.env.GITHUB_REPOSITORY;
  const docsUrl = repo
    ? `${process.env.GITHUB_SERVER_URL ?? 'https://github.com'}/${repo}/blob/main/${DOCS_PATH}`
    : DOCS_PATH;
  const content = pinReminderMessage({
    pins: PINNED_FORK_BLOCKS,
    blockTimes,
    now: Date.now(),
    docsUrl,
  });

  if (dryRun) {
    console.log(content);
    return;
  }
  let res;
  try {
    res = await globalThis.fetch(webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // No @everyone / role pings, whatever the text says
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
      signal: globalThis.AbortSignal.timeout(DISCORD_TIMEOUT_MS),
    });
  } catch (err) {
    console.error(`Could not post to Discord: ${err?.message ?? err}`);
    process.exit(1);
  }
  if (!res.ok) {
    console.error(`Discord answered ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  console.log('Pin reminder posted.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
