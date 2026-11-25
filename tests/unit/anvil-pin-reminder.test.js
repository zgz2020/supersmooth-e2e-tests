import assert from 'node:assert';
import console from 'node:console';
import process from 'node:process';
import {
  blockTimeMs,
  nextReminderMs,
  pinReminderMessage,
} from '../../scripts/anvil-pin-reminder.js';

/** Unit tests for the monthly Anvil pin reminder (no network: fetch is faked). */
const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 11, 1, 8);

async function runTests() {
  console.log('🧪 Running Anvil pin reminder unit tests...\n');

  // Test 1: the message names each pin, its date and age, and the steps
  {
    const text = pinReminderMessage({
      pins: { 1: 26491005 },
      blockTimes: { 1: NOW - 6 * DAY_MS },
      now: NOW,
      docsUrl: 'https://example.test/docs',
    });
    assert.match(text, /Chain 1: block 26491005, from 2026-11-25 \(6 days old\)/);
    assert.doesNotMatch(text, /due for a move/);
    assert.match(text, /pnpm anvil:move-pin --verify/);
    assert.match(text, /owner: QA Engineer/);
    assert.match(text, /https:\/\/example\.test\/docs/);
    assert.ok(text.length < 2000, 'fits in one Discord message');
    console.log('  ✓ Test 1 Passed: pin, date, age and steps');
  }

  // Test 2: a pin older than 30 days is flagged; an unknown age is said so
  {
    const text = pinReminderMessage({
      pins: { 1: 100, 8453: 200 },
      blockTimes: { 1: NOW - 31 * DAY_MS, 8453: null },
      now: NOW,
      docsUrl: 'x',
    });
    assert.match(text, /Chain 1: block 100, .*\(31 days old\) ⚠️ due for a move/);
    assert.match(text, /Chain 8453: block 200 \(age unknown, no RPC answered\)/);
    console.log('  ✓ Test 2 Passed: old pin flagged, unknown age reported');
  }

  // Test 3: blockTimeMs asks for the block, skips RPCs that fail or don't answer
  {
    const asked = [];
    const fakeFetch = async (url, init) => {
      asked.push({ url, body: JSON.parse(init.body) });
      if (url === 'down') throw new Error('ECONNREFUSED');
      if (url === 'empty') return { json: async () => ({ result: null }) };
      return { json: async () => ({ result: { timestamp: '0x6a000000' } }) };
    };
    const ms = await blockTimeMs(['down', 'empty', 'ok'], 26491005, fakeFetch);
    assert.strictEqual(ms, 0x6a000000 * 1000);
    assert.deepStrictEqual(
      asked.map((a) => a.url),
      ['down', 'empty', 'ok'],
    );
    assert.deepStrictEqual(asked[2].body.params, ['0x194387d', false]);
    assert.strictEqual(await blockTimeMs(['down'], 1, fakeFetch), null);
    console.log('  ✓ Test 3 Passed: block time from the first RPC that answers');
  }

  // Test 4: a pin that passes 30 days before the next reminder is flagged now
  {
    assert.strictEqual(new Date(nextReminderMs(NOW)).toISOString(), '2027-01-01T08:00:00.000Z');
    // Moved on the 3rd: 28 days old on Dec 1, 59 days old on Jan 1
    const movedOn3rd = Date.UTC(2026, 10, 3, 8);
    const text = pinReminderMessage({
      pins: { 1: 100 },
      blockTimes: { 1: movedOn3rd },
      now: NOW,
      docsUrl: 'x',
    });
    assert.match(
      text,
      /\(28 days old\) ⚠️ due for a move \(59 days old by the next check on 2027-01-01\)/,
    );
    // A fresh pin isn't flagged although it will be just over 30 days old at the next check
    const fresh = pinReminderMessage({
      pins: { 1: 100 },
      blockTimes: { 1: NOW - 1 * DAY_MS },
      now: NOW,
      docsUrl: 'x',
    });
    assert.match(fresh, /\(1 days old\)\n/);
    console.log('  ✓ Test 4 Passed: pin flagged at the reminder closest to its 30th day');
  }

  console.log('\n🎉 All 4 Anvil pin reminder tests passed successfully!');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
