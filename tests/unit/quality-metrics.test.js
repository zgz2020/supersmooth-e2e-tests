import assert from 'node:assert';
import console from 'node:console';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildRunRecord,
  collectArtifacts,
  mergeRecords,
  testOutcome,
} from '../../scripts/metrics/collect-run.js';
import {
  parseHistory,
  serializeHistory,
  trimHistory,
  upsertRuns,
} from '../../scripts/metrics/history.js';
import {
  STATUS,
  THRESHOLDS,
  computeDashboard,
  isoWeek,
  parseKnownBugsDoc,
  percentile,
  quarantinedTests,
  runPassRate,
  thresholdStatus,
} from '../../scripts/metrics/model.js';
import { renderSummary } from '../../scripts/metrics/build-dashboard.js';
import { renderDashboardHtml } from '../../scripts/metrics/render-html.js';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'metrics');
const readFixture = (name) => JSON.parse(fs.readFileSync(path.join(FIXTURES, name), 'utf-8'));
const DAY_MS = 24 * 60 * 60 * 1000;

/** Fake run record: `index` days after 2026-10-01, with the given counts and tests. */
function fakeRun(suite, index, { counts = {}, tests = [], durationMs = 600_000, ...rest } = {}) {
  return {
    runId: `${suite}-${index}`,
    suite,
    scope: 'full',
    startedAt: new Date(Date.parse('2026-10-01T01:00:00Z') + index * DAY_MS).toISOString(),
    durationMs,
    errors: 0,
    counts: {
      passed: 100,
      failed: 0,
      timedOut: 0,
      flaky: 0,
      skipped: 0,
      expectedFailure: 0,
      ...counts,
    },
    tests,
    triage: { TRANSIENT_RPC: 0, DOM_SELECTOR_DRIFT: 0, REGRESSION_DEFECT: 0 },
    knownAppBugs: [],
    ...rest,
  };
}

async function runTests() {
  console.log('🧪 Running Quality Metrics Unit Tests...\n');

  const report = readFixture('results.json');
  const record = buildRunRecord(report, {
    suite: 'no-wallet',
    triage: readFixture('triage.json'),
    env: { GITHUB_RUN_ID: '123', GITHUB_EVENT_NAME: 'schedule', GITHUB_SHA: 'abc' },
  });
  const byTc = (tc) => record.tests.find((test) => test.tc === tc);

  // Test 1: Flaky detection (failed, then passed on retry) from status and from results alone
  {
    assert.strictEqual(byTc('E2E-NAV-001').status, 'flaky');
    assert.strictEqual(byTc('E2E-NAV-001').retries, 1);
    assert.strictEqual(byTc('E2E-NAV-001').durationMs, 5000);
    const withoutStatus = {
      expectedStatus: 'passed',
      results: [{ status: 'failed' }, { status: 'passed' }],
    };
    assert.strictEqual(testOutcome(withoutStatus), 'flaky');
    assert.strictEqual(
      testOutcome({ ...withoutStatus, results: [{ status: 'passed' }] }),
      'passed',
    );
    assert.strictEqual(record.counts.flaky, 1);
    console.log('  ✓ Test 1 Passed: flaky detection');
  }

  // Test 2: knownAppBug expected failure is tracked but not counted as a failure
  {
    assert.strictEqual(byTc('E2E-NAV-003').status, 'expectedFailure');
    assert.deepStrictEqual(record.knownAppBugs, [
      {
        issue: 'https://github.com/example/app/issues/42',
        test: 'e2e/no-wallet/navigation.spec.ts::Header › recovers after a rate limit::no-wallet',
      },
    ]);
    assert.strictEqual(record.counts.expectedFailure, 1);
    assert.strictEqual(record.counts.failed, 0);
    assert.strictEqual(record.counts.timedOut, 1);
    // passed + flaky + expected failure (3) ÷ executed (4, skipped excluded)
    assert.strictEqual(runPassRate(record), 0.75);
    console.log('  ✓ Test 2 Passed: knownAppBug expected failure is not a failure');
  }

  // Test 3: The unit project is excluded; metadata, annotations, tags and triage are read
  {
    assert.strictEqual(record.tests.length, 5);
    assert(record.tests.every((test) => !test.id.endsWith('::unit')));
    assert.strictEqual(byTc('E2E-NAV-002').quarantined, true, 'tc from result annotations, tag');
    assert.strictEqual(record.runId, '123');
    assert.strictEqual(record.trigger, 'schedule');
    assert.strictEqual(record.durationMs, 600001);
    assert.strictEqual(record.triage.DOM_SELECTOR_DRIFT, 1);
    const stale = buildRunRecord(report, {
      triage: { ...readFixture('triage.json'), generatedAt: '2026-11-15T00:00:00.000Z' },
    });
    assert.strictEqual(stale.triage.DOM_SELECTOR_DRIFT, 0, 'triage older than the run is ignored');
    assert.strictEqual(stale.suite, 'no-wallet', 'suite derived from the projects');
    assert.match(stale.runId, /^local-/);
    console.log('  ✓ Test 3 Passed: unit project excluded, metadata collected');
  }

  // Test 4: Cross-browser artifacts merge into one suite record
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'metrics-test-'));
    try {
      for (const name of [
        'results-json-cross-browser-firefox',
        'results-json-cross-browser-webkit',
      ]) {
        fs.mkdirSync(path.join(dir, name, 'test-results'), { recursive: true });
        fs.copyFileSync(
          path.join(FIXTURES, 'results.json'),
          path.join(dir, name, 'test-results', 'results.json'),
        );
      }
      const records = collectArtifacts(dir, { env: { GITHUB_RUN_ID: '9' } });
      assert.strictEqual(records.length, 1);
      assert.strictEqual(records[0].suite, 'cross-browser');
      assert.strictEqual(records[0].tests.length, 10);
      assert.strictEqual(records[0].counts.flaky, 2);
      assert.strictEqual(mergeRecords([record]), record);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    console.log('  ✓ Test 4 Passed: parallel artifacts merge per suite');
  }

  // Test 5: Threshold -> colour mapping at the boundaries
  {
    const pass = (v) => thresholdStatus(v, THRESHOLDS.passRate);
    assert.deepStrictEqual(
      [pass(0.98), pass(0.9799), pass(0.95), pass(0.9499)],
      ['green', 'amber', 'amber', 'red'],
    );
    assert.strictEqual(pass(49 / 50), STATUS.GREEN, 'floating point 98% is green');
    const flaky = (v) => thresholdStatus(v, THRESHOLDS.flakyRate);
    assert.deepStrictEqual(
      [flaky(0.02), flaky(0.0201), flaky(0.05), flaky(0.0501)],
      ['green', 'amber', 'amber', 'red'],
    );
    const p1 = (v) => thresholdStatus(v, THRESHOLDS.p1Coverage);
    assert.deepStrictEqual(
      [p1(0.9), p1(0.89), p1(0.75), p1(0.74)],
      ['green', 'amber', 'amber', 'red'],
    );
    const runs = (v) => thresholdStatus(v, THRESHOLDS.flakyRuns);
    assert.deepStrictEqual([runs(1), runs(2), runs(3)], ['green', 'amber', 'red']);
    assert.strictEqual(thresholdStatus(null, THRESHOLDS.passRate), STATUS.NA);
    console.log('  ✓ Test 5 Passed: threshold boundaries');
  }

  // Test 6: Fewer than 7 previous runs -> trends are n/a, nothing crashes, page renders
  {
    for (const history of [
      [],
      [fakeRun('api', 0)],
      Array.from({ length: 7 }, (_, i) => fakeRun('api', i)),
    ]) {
      const dashboard = computeDashboard(history, { cases: [] });
      assert(Object.values(dashboard.trends).every((t) => t === null));
      assert(renderSummary(dashboard).includes('| M1 Pass rate |'));
      assert(renderSummary(dashboard).includes('n/a'));
      const html = renderDashboardHtml(dashboard, { caseUrl: () => undefined, generatedAt: 'now' });
      assert(html.includes('trend n/a'));
      assert(
        !/<(script|link|img)\b/.test(html),
        'self-contained: no scripts, stylesheets or images',
      );
    }
    assert.strictEqual(computeDashboard([], {}).health.status, STATUS.NA);
    console.log('  ✓ Test 6 Passed: short history shows n/a trends without crashing');
  }

  // Test 7: Trends, insights and health with enough history
  {
    const flakyTest = (status) => [
      { id: 'f.spec.ts::flaky one::with-wallet', tc: 'E2E-X-001', status },
    ];
    const history = Array.from({ length: 14 }, (_, i) =>
      fakeRun('with-wallet', i, {
        counts: i >= 7 ? { passed: 96, flaky: 4 } : { passed: 100, flaky: i === 0 ? 1 : 0 },
        tests: flakyTest(i >= 10 ? 'flaky' : 'passed'),
      }),
    );
    const cases = [
      { id: 'E2E-X-001', title: 'one', priority: 'P1', automation: 'automated', file: 'x.md' },
      { id: 'E2E-X-002', title: 'two', priority: 'P1', automation: 'manual', file: 'x.md' },
    ];
    const d = computeDashboard(history, { cases, now: '2026-10-15T00:00:00Z' });
    assert.strictEqual(d.trends.M2.direction, 'up');
    assert.strictEqual(d.trends.M2.better, false);
    assert.strictEqual(d.M3.value, 4);
    assert.strictEqual(d.M3.status, STATUS.RED);
    assert.strictEqual(d.M5.status, STATUS.RED);
    assert.strictEqual(d.health.status, STATUS.RED);
    assert.match(d.health.sentence, /^Red — /);
    const texts = d.insights.map((i) => i.text).join('\n');
    assert.match(texts, /Flaky rate rose/);
    assert.match(texts, /1 test flaky in ≥ 3 of the last 14 runs: E2E-X-001 \(4\/14\)/);
    assert.match(texts, /P1 automation coverage is 50.0%.*E2E-X-002/);
    assert(d.insights.length >= 3 && d.insights.every((i) => i.owner && i.action));
    console.log('  ✓ Test 7 Passed: trends, insights with owners and health status');
  }

  // Test 8: History trimming keeps the last 200 runs per suite; upsert replaces re-runs
  {
    const history = [
      ...Array.from({ length: 205 }, (_, i) => fakeRun('no-wallet', i)),
      ...Array.from({ length: 3 }, (_, i) => fakeRun('api', i)),
    ];
    const trimmed = trimHistory(history);
    assert.strictEqual(trimmed.filter((r) => r.suite === 'no-wallet').length, 200);
    assert.strictEqual(trimmed.filter((r) => r.suite === 'api').length, 3);
    assert(
      !trimmed.some((r) => r.runId === 'no-wallet-4') &&
        trimmed.some((r) => r.runId === 'no-wallet-5'),
    );
    const rerun = upsertRuns(trimmed, [fakeRun('api', 2, { counts: { passed: 1 } })]);
    assert.strictEqual(rerun.length, trimmed.length);
    assert.strictEqual(rerun.find((r) => r.runId === 'api-2').counts.passed, 1);
    assert.deepStrictEqual(parseHistory(serializeHistory(rerun)), rerun);
    assert.throws(() => parseHistory('{"a":1}\nnot json\n'), /line 2/);
    console.log('  ✓ Test 8 Passed: history trimming and idempotent upsert');
  }

  // Test 9: Quarantine age and exit criterion count only green runs since the tag
  {
    const id = 'q.spec.ts::q::no-wallet';
    const history = Array.from({ length: 14 }, (_, i) =>
      fakeRun('no-wallet', i, {
        tests: [
          { id, status: i === 3 ? 'flaky' : 'passed', ...(i >= 2 ? { quarantined: true } : {}) },
        ],
      }),
    );
    const [q] = quarantinedTests(history, '2026-10-15T01:00:00Z');
    assert.strictEqual(q.greenStreak, 10);
    assert.strictEqual(q.readyToExit, true);
    assert.strictEqual(q.ageDays, 12);
    assert.strictEqual(
      quarantinedTests(history.slice(0, 12), '2026-10-15T01:00:00Z')[0].readyToExit,
      false,
    );
    console.log('  ✓ Test 9 Passed: quarantine age and exit criterion');
  }

  // Test 10: Known bugs register parsing, age and M7 status; small helpers
  {
    const doc = fs.readFileSync(
      path.join(FIXTURES, '..', '..', '..', '..', 'docs', 'known-app-bugs.md'),
      'utf-8',
    );
    const bugs = parseKnownBugsDoc(doc);
    assert(bugs.length >= 1 && bugs.every((b) => /^https:\/\//.test(b.issue)));
    const registerBugs = [
      {
        issue: 'https://github.com/o/app/issues/1',
        label: 'app#1',
        test: 't',
        addedAt: '2026-09-01',
      },
    ];
    const d = computeDashboard([fakeRun('api', 0)], { registerBugs, now: '2026-10-15T00:00:00Z' });
    assert.strictEqual(d.M7.value, 1);
    assert.strictEqual(d.M7.oldestDays, 44);
    assert.strictEqual(d.M7.status, STATUS.RED, 'older than 30 days is red');
    assert.strictEqual(percentile([5, 1, 3, 2, 4], 0.95), 5);
    assert.strictEqual(isoWeek('2026-11-16T10:00:00Z'), '2026-W47');
    assert.strictEqual(isoWeek('2027-01-01T10:00:00Z'), '2026-W53');
    console.log('  ✓ Test 10 Passed: known bugs register, M7 status, helpers');
  }

  console.log('\n🎉 All 10 Quality Metrics tests passed successfully!\n');
}

await runTests();
