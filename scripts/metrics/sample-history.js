/**
 * Deterministic SAMPLE history for demos and the docs screenshot (`pnpm metrics:dashboard
 * --sample`). Every record is marked `sample: true`, and the dashboard shows a "SAMPLE DATA"
 * banner for it. Test IDs come from the real catalogue so case links work.
 *
 * The story it tells: with-wallet tests that depend on RPC calls get flaky in the last two weeks,
 * one test is flaky in most runs, RPC errors dominate the failure mix and the with-wallet suite
 * slows down. One quarantined test has earned its way out.
 */
import { coverageByPriority, suiteFamily } from './collect-run.js';

const RUNS_PER_SUITE = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Small seeded PRNG (mulberry32), so the sample is identical on every machine. */
function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WITH_WALLET_FILES = ['open-position', 'protocol-cases', 'automations'];

function suiteOfCase(testCase) {
  if (testCase.id.startsWith('API-')) return 'api';
  const file = testCase.file.split('/').pop().replace('.md', '');
  if (file === 'cross-browser') return suiteFamily('cross-browser');
  return WITH_WALLET_FILES.includes(file) ? 'with-wallet' : 'no-wallet';
}

/**
 * @param {Array<{ id: string, title: string, file: string, automation?: string, priority?: string }>} cases
 * @param {string} endIso - timestamp of the most recent sample run
 */
export function sampleHistory(cases, endIso = new Date().toISOString()) {
  const rand = random(20261116);
  const automated = cases.filter((c) => c.automation === 'automated');
  const suites = ['no-wallet', 'with-wallet', 'api', 'cross-browser'];
  const testsBySuite = Object.fromEntries(
    suites.map((suite) => [
      suite,
      automated
        .filter((c) => suiteOfCase(c) === suite)
        .map((c) => ({
          id: `e2e/${suite}/${c.file.split('/').pop().replace('.md', '')}.spec.ts::${c.title}::${suite === 'cross-browser' ? 'webkit' : suite}`,
          tc: c.id,
        })),
    ]),
  );
  const rpcDependent = new Set(testsBySuite['with-wallet'].slice(0, 3).map((t) => t.id));
  const chronic = testsBySuite['with-wallet'][0]?.id;
  const quarantined = testsBySuite['no-wallet'][0]?.id;
  const baseDuration = {
    'no-wallet': 540_000,
    'with-wallet': 1_260_000,
    api: 95_000,
    'cross-browser': 410_000,
  };
  const register = [
    { issue: 'https://github.com/example/app/issues/101', after: 4 },
    { issue: 'https://github.com/example/app/issues/117', after: 20 },
  ];

  const coverage = coverageByPriority(cases);
  const records = [];
  const end = Date.parse(endIso);
  for (const [suiteIndex, suite] of suites.entries()) {
    for (let run = 0; run < RUNS_PER_SUITE; run++) {
      const recent = run >= RUNS_PER_SUITE - 10;
      const startedAt = new Date(
        end - (RUNS_PER_SUITE - 1 - run) * 2 * DAY_MS - suiteIndex * 600_000,
      ).toISOString();
      const triage = { TRANSIENT_RPC: 0, DOM_SELECTOR_DRIFT: 0, REGRESSION_DEFECT: 0 };
      const knownAppBugs = [];
      const tests = testsBySuite[suite].map((test, index) => {
        let status = 'passed';
        const roll = rand();
        if (test.id === chronic && recent && roll < 0.6) status = 'flaky';
        else if (rpcDependent.has(test.id) && recent && roll < 0.25) status = 'flaky';
        else if (roll < 0.004) status = 'flaky';
        else if (roll > 0.997) status = 'failed';
        if (test.id === quarantined && run >= 14 && run < 18) status = 'flaky';
        // RPC-dependent tests also fail outright a few times in the last week
        if (rpcDependent.has(test.id) && run >= RUNS_PER_SUITE - 3 && roll < 0.4) {
          status = 'failed';
        }
        if (status === 'failed') {
          const cls =
            suite === 'with-wallet' || rand() < 0.5 ? 'TRANSIENT_RPC' : 'DOM_SELECTOR_DRIFT';
          triage[cls] += 1;
        }
        const bug = suite === 'no-wallet' && register[index - 1];
        if (bug && run >= bug.after) {
          status = 'expectedFailure';
          knownAppBugs.push({ issue: bug.issue, test: test.id });
        }
        return {
          ...test,
          status,
          durationMs: 8_000 + Math.round(rand() * 20_000),
          retries: status === 'flaky' ? 1 : status === 'failed' ? 2 : 0,
          ...(test.id === quarantined && run >= 14 ? { quarantined: true } : {}),
        };
      });
      if (suite === 'api' && run === RUNS_PER_SUITE - 6) triage.REGRESSION_DEFECT += 1;
      const counts = {
        passed: 0,
        failed: 0,
        timedOut: 0,
        flaky: 0,
        skipped: 0,
        expectedFailure: 0,
      };
      tests.forEach((t) => (counts[t.status] += 1));
      if (triage.REGRESSION_DEFECT) {
        counts.failed += 1;
        counts.passed -= 1;
      }
      const slowdown = suite === 'with-wallet' && recent ? 1.32 : 1;
      records.push({
        runId: `sample-${suiteIndex}-${run}`,
        suite,
        scope: 'full',
        startedAt,
        durationMs: Math.round(baseDuration[suite] * slowdown * (0.92 + rand() * 0.16)),
        commit: null,
        branch: 'main',
        trigger: 'schedule',
        workflow: 'Nightly Run',
        errors: 0,
        counts,
        tests,
        triage,
        knownAppBugs,
        // P1 coverage grew by 4 cases five runs ago
        coverage: {
          ...coverage,
          P1: { ...coverage.P1, automated: coverage.P1.automated - (run < 25 ? 4 : 0) },
        },
        sample: true,
      });
    }
  }
  return records.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}
