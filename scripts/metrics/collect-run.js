#!/usr/bin/env node
/**
 * Collects one quality-metrics run record from a Playwright JSON report and appends it to the
 * metrics history (see scripts/metrics/history.js).
 *
 * A record holds per-test outcomes (passed / failed / timedOut / flaky / skipped /
 * expectedFailure), the AI triage classification counts of the run's failures, the known app bugs
 * the run tracked and a snapshot of catalogue automation coverage per priority.
 *
 * Usage:
 *   pnpm metrics:collect                                  # test-results/results.json -> .metrics/
 *   pnpm metrics:collect --results path/results.json --suite no-wallet
 *   node scripts/metrics/collect-run.js --artifacts-dir metrics-input --history metrics-data/metrics/history.jsonl
 *
 * Options:
 *   --results <file>        Playwright JSON report (default test-results/results.json)
 *   --triage <file>         AI triage data (default ai-reports/latest-triage-data.json, if present)
 *   --suite <name>          suite name (default: derived from the report's Playwright projects)
 *   --scope <full|regression>  which test selection ran (default: METRICS_SCOPE or "full")
 *   --artifacts-dir <dir>   CI mode: one sub-folder per `results-json-<suite>` artifact, each with
 *                           test-results/results.json (+ ai-reports/latest-triage-data.json)
 *   --history <file>        history file (default .metrics/history.jsonl)
 *
 * See docs/quality-metrics.md.
 */
import console from 'node:console';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { PRIORITIES, REPO_ROOT, TC_ANNOTATION_TYPE, loadCatalogue } from '../tc/catalogue.js';
import { EXCLUDED_PROJECTS } from '../tc/check-traceability.js';
import {
  DEFAULT_HISTORY_PATH,
  MAX_RUNS_PER_SUITE,
  readHistory,
  trimHistory,
  upsertRuns,
  writeHistory,
} from './history.js';

export const STATUSES = ['passed', 'failed', 'timedOut', 'flaky', 'skipped', 'expectedFailure'];
export const TRIAGE_CLASSES = ['TRANSIENT_RPC', 'DOM_SELECTOR_DRIFT', 'REGRESSION_DEFECT'];
export const QUARANTINE_TAG = 'quarantine';
export const ARTIFACT_PREFIX = 'results-json-';

const CROSS_BROWSER_PROJECTS = [
  'firefox',
  'webkit',
  'mobile-safari',
  'mobile-android',
  'tablet-ipad',
  'desktop-large',
];

/** Suite a project or artifact belongs to: all cross-browser projects form one suite, as do API ones. */
export function suiteFamily(name) {
  if (name.startsWith('cross-browser') || CROSS_BROWSER_PROJECTS.includes(name)) {
    return 'cross-browser';
  }
  if (name.startsWith('api')) return 'api';
  return name;
}

/** Final outcome of one test (one project), from Playwright's `status` or, if absent, its results. */
export function testOutcome(test) {
  const results = test.results ?? [];
  const last = results.at(-1);
  let status = test.status;
  if (!status) {
    const passedLast = last?.status === test.expectedStatus;
    const failedBefore = results.slice(0, -1).some((r) => r.status !== test.expectedStatus);
    if (!last || last.status === 'skipped') status = 'skipped';
    else if (passedLast) status = failedBefore ? 'flaky' : 'expected';
    else status = 'unexpected';
  }
  switch (status) {
    case 'flaky':
      return 'flaky';
    case 'skipped':
      return 'skipped';
    case 'expected':
      // `test.fail()` (knownAppBug) that failed as expected: tracked, not counted as a failure
      return test.expectedStatus === 'failed' ? 'expectedFailure' : 'passed';
    default:
      return last?.status === 'timedOut' ? 'timedOut' : 'failed';
  }
}

const emptyCounts = () => Object.fromEntries(STATUSES.map((status) => [status, 0]));
const emptyTriage = () => Object.fromEntries(TRIAGE_CLASSES.map((cls) => [cls, 0]));

/** Flattens a Playwright JSON report into one entry per test and project (unit project excluded). */
export function collectTestOutcomes(report) {
  const tests = [];
  const visit = (suite, titles, file) => {
    for (const spec of suite.specs ?? []) {
      const specFile = spec.file ?? file;
      const tags = (spec.tags ?? []).map((tag) => tag.replace(/^@/, ''));
      for (const test of spec.tests ?? []) {
        if (EXCLUDED_PROJECTS.includes(test.projectName)) continue;
        const results = test.results ?? [];
        const annotations = [
          ...(test.annotations ?? []),
          ...results.flatMap((result) => result.annotations ?? []),
        ];
        const find = (type) => annotations.find((a) => a.type === type)?.description;
        tests.push({
          id: [specFile, [...titles, spec.title].join(' › '), test.projectName].join('::'),
          tc: find(TC_ANNOTATION_TYPE),
          status: testOutcome(test),
          durationMs: Math.round(results.reduce((sum, r) => sum + (r.duration ?? 0), 0)),
          retries: Math.max(results.length - 1, 0),
          project: test.projectName,
          ...(find('issue') ? { issue: find('issue') } : {}),
          ...(tags.includes(QUARANTINE_TAG) ? { quarantined: true } : {}),
        });
      }
    }
    // Top-level suites are files (titled with the path); nested ones are describe() blocks
    for (const child of suite.suites ?? []) visit(child, [...titles, child.title], file);
  };
  for (const fileSuite of report.suites ?? []) visit(fileSuite, [], fileSuite.file);
  return tests;
}

/** Counts AI triage classifications; ignores a triage file older than the report (stale). */
export function countTriage(triage, startedAt) {
  const counts = emptyTriage();
  if (!triage?.analyses) return counts;
  if (triage.generatedAt && startedAt && triage.generatedAt < startedAt) return counts;
  for (const analysis of triage.analyses) {
    if (analysis.classification in counts) counts[analysis.classification] += 1;
  }
  return counts;
}

/** Automation coverage of the catalogue per priority (stored per run so M5 has a trend). */
export function coverageByPriority(cases) {
  return Object.fromEntries(
    PRIORITIES.map((priority) => {
      const ofPriority = cases.filter((c) => c.priority === priority);
      return [
        priority,
        {
          automated: ofPriority.filter((c) => c.automation === 'automated').length,
          total: ofPriority.length,
        },
      ];
    }),
  );
}

/** Builds one run record. `context` carries suite, triage, coverage and CI metadata. */
export function buildRunRecord(report, context = {}) {
  const env = context.env ?? {};
  const tests = collectTestOutcomes(report);
  const counts = emptyCounts();
  tests.forEach((test) => (counts[test.status] += 1));
  const startedAt = report.stats?.startTime ?? new Date().toISOString();
  const projects = [...new Set(tests.map((test) => test.project))];
  const families = [...new Set(projects.map(suiteFamily))];

  return {
    runId: env.GITHUB_RUN_ID ?? `local-${Date.parse(startedAt)}`,
    suite: context.suite ?? (families.length === 1 ? families[0] : 'local'),
    scope: context.scope ?? 'full',
    startedAt,
    durationMs: Math.round(report.stats?.duration ?? 0),
    commit: context.commit ?? env.GITHUB_SHA ?? null,
    branch: context.branch ?? (env.GITHUB_HEAD_REF || env.GITHUB_REF_NAME || null),
    trigger: env.GITHUB_EVENT_NAME ?? 'local',
    workflow: env.GITHUB_WORKFLOW ?? null,
    errors: (report.errors ?? []).length,
    counts,
    tests: tests.map(({ project: _project, ...test }) => test),
    triage: countTriage(context.triage, startedAt),
    knownAppBugs: tests
      .filter((test) => test.issue)
      .map((test) => ({ issue: test.issue, test: test.id })),
    ...(context.coverage ? { coverage: context.coverage } : {}),
  };
}

/** Merges records of one suite produced by parallel jobs (e.g. one per cross-browser project). */
export function mergeRecords(records) {
  if (records.length === 1) return records[0];
  const [first] = records;
  const sum = (pick, keys) =>
    Object.fromEntries(keys.map((key) => [key, records.reduce((s, r) => s + pick(r)[key], 0)]));
  return {
    ...first,
    startedAt: records.map((r) => r.startedAt).sort()[0],
    durationMs: Math.max(...records.map((r) => r.durationMs)),
    errors: records.reduce((s, r) => s + r.errors, 0),
    counts: sum((r) => r.counts, STATUSES),
    tests: records.flatMap((r) => r.tests),
    triage: sum((r) => r.triage, TRIAGE_CLASSES),
    knownAppBugs: records.flatMap((r) => r.knownAppBugs),
  };
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf-8'));
const readJsonIfExists = (file) => (file && fs.existsSync(file) ? readJson(file) : undefined);

/** CI mode: one record per suite from `<dir>/results-json-<name>/` artifact folders. */
export function collectArtifacts(dir, context) {
  const bySuite = new Map();
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith(ARTIFACT_PREFIX)) continue;
    const folder = path.join(dir, entry.name);
    const resultsFile = path.join(folder, 'test-results', 'results.json');
    if (!fs.existsSync(resultsFile)) continue;
    const suite = suiteFamily(entry.name.slice(ARTIFACT_PREFIX.length));
    const record = buildRunRecord(readJson(resultsFile), {
      ...context,
      suite,
      triage: readJsonIfExists(path.join(folder, 'ai-reports', 'latest-triage-data.json')),
    });
    bySuite.set(suite, [...(bySuite.get(suite) ?? []), record]);
  }
  return [...bySuite.values()].map(mergeRecords);
}

function gitValue(args) {
  const result = spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf-8' });
  return result.status === 0 ? result.stdout.trim() || null : null;
}

export function parseArgs(argv) {
  const args = {
    results: path.join(REPO_ROOT, 'test-results', 'results.json'),
    triage: path.join(REPO_ROOT, 'ai-reports', 'latest-triage-data.json'),
    history: DEFAULT_HISTORY_PATH,
  };
  const keys = { '--artifacts-dir': 'artifactsDir' };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (!flag.startsWith('--')) continue;
    const key = keys[flag] ?? flag.slice(2);
    args[key] = argv[++i];
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = process.env;
  const context = {
    env,
    scope: args.scope ?? env.METRICS_SCOPE ?? 'full',
    coverage: coverageByPriority(loadCatalogue().cases),
    commit: env.GITHUB_SHA ?? gitValue(['rev-parse', 'HEAD']),
    branch: env.GITHUB_HEAD_REF || env.GITHUB_REF_NAME || gitValue(['branch', '--show-current']),
  };

  let records;
  if (args.artifactsDir) {
    records = fs.existsSync(args.artifactsDir) ? collectArtifacts(args.artifactsDir, context) : [];
  } else {
    if (!fs.existsSync(args.results)) {
      console.error(`❌ No Playwright JSON report at ${args.results}: run a test suite first.`);
      process.exit(1);
    }
    records = [
      buildRunRecord(readJson(args.results), {
        ...context,
        suite: args.suite,
        triage: readJsonIfExists(args.triage),
      }),
    ];
  }
  // A report with no product tests (e.g. only the unit project ran) is not a suite run
  records = records.filter((record) => record.tests.length || record.errors);
  if (!records.length) {
    console.log('ℹ️  No product test results found: nothing to collect.');
    return;
  }

  const history = trimHistory(upsertRuns(readHistory(args.history), records), MAX_RUNS_PER_SUITE);
  writeHistory(args.history, history);
  for (const record of records) {
    const { passed, failed, timedOut, flaky, skipped, expectedFailure } = record.counts;
    console.log(
      `📈 ${record.suite} (${record.runId}): ${passed} passed, ${failed + timedOut} failed, ` +
        `${flaky} flaky, ${expectedFailure} known bug, ${skipped} skipped`,
    );
  }
  console.log(`💾 ${history.length} runs in ${path.relative(process.cwd(), args.history)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    console.error(`❌ metrics:collect failed: ${error.message}`);
    process.exit(1);
  }
}
