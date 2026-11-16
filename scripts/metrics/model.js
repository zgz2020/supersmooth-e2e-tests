/**
 * Quality metrics model: definitions, thresholds, owners and the computation of M1–M7 from the
 * run history, plus rule-based insights. Pure functions only (no I/O), so every rule is unit
 * tested (tests/unit/quality-metrics.test.js).
 *
 * Every metric has a threshold, an owner and an action: a number nobody acts on is not tracked.
 * See docs/quality-metrics.md.
 */
import { PRIORITIES } from '../tc/catalogue.js';
import { STATUSES, TRIAGE_CLASSES } from './collect-run.js';

export const STATUS = { GREEN: 'green', AMBER: 'amber', RED: 'red', NA: 'n/a' };
const RANK = { [STATUS.NA]: -1, [STATUS.GREEN]: 0, [STATUS.AMBER]: 1, [STATUS.RED]: 2 };

/** Rolling window (runs per suite) for flaky rate, top flaky tests and duration p95. */
export const WINDOW_RUNS = 14;
/** Trend arrows compare against the value this many runs ago (per suite). */
export const TREND_RUNS = 7;
/** Runs per suite shown in the line charts. */
export const CHART_RUNS = 30;
/** Weeks shown in the failure cause mix chart. */
export const CHART_WEEKS = 8;
/** Minimum runs in a duration window before p95 is compared with its baseline. */
export const MIN_DURATION_RUNS = 5;
/** Quarantine exit criterion: consecutive green runs (nightly; regression excludes them). */
export const QUARANTINE_EXIT_RUNS = 10;
/** A known app bug open longer than this turns M7 red. */
export const KNOWN_BUG_MAX_AGE_DAYS = 30;
/** Flaky rate rising more than this (vs 7 runs ago) raises an insight. */
export const FLAKY_RISE_RATIO = 1.5;

export const THRESHOLDS = {
  passRate: { green: 0.98, amber: 0.95, higherIsBetter: true },
  flakyRate: { green: 0.02, amber: 0.05, higherIsBetter: false },
  flakyRuns: { green: 1, amber: 2, higherIsBetter: false },
  p1Coverage: { green: 0.9, amber: 0.75, higherIsBetter: true },
  durationIncrease: { green: 0.1, amber: 0.25, higherIsBetter: false },
  knownBugs: { green: 0, amber: 2, higherIsBetter: false },
};

/** Who reads each metric and what they do when it is not green. Rendered in the dashboard. */
export const METRICS = {
  M1: { name: 'Pass rate', owner: 'QA on-call', action: 'Triage failures before the next merge' },
  M2: { name: 'Flaky rate', owner: 'Test owner', action: 'Fix or quarantine within 2 days' },
  M3: {
    name: 'Top flaky tests',
    owner: 'Test owner',
    action: 'Tag @quarantine (≥ 3 of 14) and fix',
  },
  M4: {
    name: 'Failure cause mix',
    owner: 'QA lead',
    action: 'RPC-heavy → infra issue; selector drift → test-design debt',
  },
  M5: {
    name: 'Automation coverage (P1)',
    owner: 'QA lead',
    action: 'Schedule automation of the top manual P1 cases',
  },
  M6: { name: 'Suite duration p95', owner: 'QA', action: 'Profile slow tests, rebalance workers' },
  M7: { name: 'Known app bugs', owner: 'Product / Eng lead', action: 'Prioritise the fixes' },
};

/** Metrics that make up the overall health badge. */
export const HEADLINE_METRICS = ['M1', 'M2', 'M5', 'M7'];

// ---------------------------------------------------------------------------------------------
// Small helpers

const EPSILON = 1e-9;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Maps a value to green / amber / red; `null` (no data) maps to n/a. Boundaries are inclusive. */
export function thresholdStatus(value, { green, amber, higherIsBetter }) {
  if (value === null || value === undefined || Number.isNaN(value)) return STATUS.NA;
  if (higherIsBetter) {
    if (value >= green - EPSILON) return STATUS.GREEN;
    return value >= amber - EPSILON ? STATUS.AMBER : STATUS.RED;
  }
  if (value <= green + EPSILON) return STATUS.GREEN;
  return value <= amber + EPSILON ? STATUS.AMBER : STATUS.RED;
}

export const worstStatus = (statuses) =>
  statuses.reduce((worst, status) => (RANK[status] > RANK[worst] ? status : worst), STATUS.NA);

export const formatPercent = (value) =>
  value === null || value === undefined ? 'n/a' : `${(value * 100).toFixed(1)}%`;

export function formatDuration(ms) {
  if (ms === null || ms === undefined) return 'n/a';
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return minutes ? `${minutes}m ${String(seconds).padStart(2, '0')}s` : `${seconds}s`;
}

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
const sum = (values) => values.reduce((total, value) => total + value, 0);

/** Nearest-rank percentile (p in 0..1) of a non-empty list. */
export function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(Math.ceil(p * sorted.length) - 1, 0)];
}

const executedCount = (counts) =>
  sum(STATUSES.filter((s) => s !== 'skipped').map((s) => counts[s] ?? 0));

/**
 * M1 for one run: tests that ended green (passed, flaky = passed on retry, known app bug failing
 * as expected) ÷ executed (all but skipped). A run that crashed before any test ran counts as 0%.
 */
export function runPassRate(record) {
  const executed = executedCount(record.counts);
  if (!executed) return record.errors ? 0 : null;
  const { passed = 0, flaky = 0, expectedFailure = 0 } = record.counts;
  return (passed + flaky + expectedFailure) / executed;
}

export function runFlakyRate(record) {
  const executed = executedCount(record.counts);
  return executed ? (record.counts.flaky ?? 0) / executed : null;
}

const byStart = (a, b) => String(a.startedAt).localeCompare(String(b.startedAt));

/** Map of suite -> its runs, oldest first. */
export function groupBySuite(history) {
  const suites = new Map();
  for (const record of [...history].sort(byStart)) {
    suites.set(record.suite, [...(suites.get(record.suite) ?? []), record]);
  }
  return suites;
}

/** ISO-8601 week key, e.g. `2026-W47`. */
export function isoWeek(timestamp) {
  const date = new Date(timestamp);
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - weekday);
  const yearStart = Date.UTC(day.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((day - yearStart) / DAY_MS + 1) / 7);
  return `${day.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

const daysBetween = (from, to) =>
  Math.max(Math.floor((Date.parse(to) - Date.parse(from)) / DAY_MS), 0);

// ---------------------------------------------------------------------------------------------
// Known app bugs register (docs/known-app-bugs.md)

/** Parses the "Current known bugs" table: issue link, test, added date, summary. */
export function parseKnownBugsDoc(markdown) {
  const section = markdown.split(/^##\s+Current known bugs\s*$/m)[1] ?? '';
  const bugs = [];
  for (const line of section.split(/\r?\n/)) {
    if (!line.startsWith('|')) continue;
    const cells = line
      .slice(1, line.trimEnd().endsWith('|') ? line.trimEnd().length - 1 : undefined)
      .split(/(?<!\\)\|/)
      .map((cell) => cell.trim());
    const link = cells[0]?.match(/\[([^\]]+)\]\(([^)]+)\)/);
    const added = cells.find((cell) => /^\d{4}-\d{2}-\d{2}$/.test(cell));
    if (!link) continue;
    bugs.push({
      label: link[1],
      issue: link[2],
      test: (cells[1] ?? '').replace(/`/g, ''),
      addedAt: added ?? null,
      summary: cells[3] ?? '',
    });
  }
  return bugs;
}

/** `https://github.com/<owner>/<repo>/issues/<n>` -> `<repo>#<n>`; other URLs are kept as-is. */
export function issueLabel(url) {
  const match = url.match(/github\.com\/[^/]+\/([^/]+)\/issues\/(\d+)/);
  return match ? `${match[1]}#${match[2]}` : url;
}

/** Open known bugs: the register plus `issue` annotations seen in each suite's latest run. */
export function openKnownBugs(suites, registerBugs, now) {
  const bugs = new Map();
  for (const bug of registerBugs) {
    if (bug.addedAt && bug.addedAt > now.slice(0, 10)) continue;
    bugs.set(bug.issue, { ...bug, source: 'register' });
  }
  for (const runs of suites.values()) {
    for (const { issue, test } of runs.at(-1).knownAppBugs ?? []) {
      const firstSeen = runs.find((run) => run.knownAppBugs?.some((b) => b.issue === issue));
      const existing = bugs.get(issue);
      bugs.set(issue, {
        label: existing?.label ?? issueLabel(issue),
        issue,
        test: existing?.test ?? test,
        summary: existing?.summary ?? '',
        addedAt: existing?.addedAt ?? firstSeen.startedAt.slice(0, 10),
        source: existing ? 'register + run' : 'run',
      });
    }
  }
  return [...bugs.values()]
    .map((bug) => ({ ...bug, ageDays: bug.addedAt ? daysBetween(bug.addedAt, now) : null }))
    .sort((a, b) => (b.ageDays ?? 0) - (a.ageDays ?? 0));
}

// ---------------------------------------------------------------------------------------------
// Snapshot: M1–M7 at the end of a history

function flakyTests(suites) {
  const tests = new Map();
  for (const runs of suites.values()) {
    for (const run of runs.slice(-WINDOW_RUNS)) {
      for (const test of run.tests ?? []) {
        const entry = tests.get(test.id) ?? { id: test.id, tc: test.tc, flaky: 0, runs: 0 };
        entry.runs += 1;
        entry.tc ??= test.tc;
        if (test.status === 'flaky') {
          entry.flaky += 1;
          entry.lastFlakyAt = run.startedAt;
        }
        tests.set(test.id, entry);
      }
    }
  }
  return [...tests.values()]
    .filter((test) => test.flaky > 0)
    .sort((a, b) => b.flaky - a.flaky || String(b.lastFlakyAt).localeCompare(a.lastFlakyAt));
}

/** Failure causes per ISO week: AI triage classes plus failures that were not triaged. */
export function weeklyCauseMix(history) {
  const weeks = new Map();
  for (const record of history) {
    const week = isoWeek(record.startedAt);
    const entry = weeks.get(week) ?? {
      week,
      ...Object.fromEntries(TRIAGE_CLASSES.map((c) => [c, 0])),
      untriaged: 0,
    };
    const triaged = sum(TRIAGE_CLASSES.map((c) => record.triage?.[c] ?? 0));
    TRIAGE_CLASSES.forEach((c) => (entry[c] += record.triage?.[c] ?? 0));
    const failures = (record.counts.failed ?? 0) + (record.counts.timedOut ?? 0);
    entry.untriaged += Math.max(failures - triaged, 0);
    weeks.set(week, entry);
  }
  return [...weeks.values()].sort((a, b) => a.week.localeCompare(b.week));
}

const triagedTotal = (week) => sum(TRIAGE_CLASSES.map((c) => week[c]));
const share = (week, cls) => (triagedTotal(week) ? week[cls] / triagedTotal(week) : null);

function durationRow(suite, runs) {
  const scope = runs.at(-1).scope ?? 'full';
  const sameScope = runs.filter((run) => (run.scope ?? 'full') === scope);
  const current = sameScope.slice(-WINDOW_RUNS).map((run) => run.durationMs);
  const baseline = sameScope.slice(-2 * WINDOW_RUNS, -WINDOW_RUNS).map((run) => run.durationMs);
  const p95 = percentile(current, 0.95);
  const baselineP95 =
    baseline.length >= MIN_DURATION_RUNS && current.length >= MIN_DURATION_RUNS
      ? percentile(baseline, 0.95)
      : null;
  const increase = baselineP95 ? p95 / baselineP95 - 1 : null;
  return {
    suite,
    scope,
    p95,
    baselineP95,
    increase,
    status: thresholdStatus(increase, THRESHOLDS.durationIncrease),
  };
}

/** Quarantined tests (tagged @quarantine in their latest run), age and green streak. */
export function quarantinedTests(history, now) {
  const appearances = new Map();
  for (const record of [...history].sort(byStart)) {
    for (const test of record.tests ?? []) {
      appearances.set(test.id, [
        ...(appearances.get(test.id) ?? []),
        { ...test, at: record.startedAt },
      ]);
    }
  }
  const quarantined = [];
  for (const [id, runs] of appearances) {
    if (!runs.at(-1).quarantined) continue;
    let firstQuarantined = runs.length - 1;
    while (firstQuarantined > 0 && runs[firstQuarantined - 1].quarantined) firstQuarantined -= 1;
    // Only runs since the tag was added count towards the exit criterion
    let greenStreak = 0;
    for (let i = runs.length - 1; i >= firstQuarantined && runs[i].status === 'passed'; i--) {
      greenStreak += 1;
    }
    const since = runs[firstQuarantined].at;
    quarantined.push({
      id,
      tc: runs.at(-1).tc,
      since,
      ageDays: daysBetween(since, now),
      greenStreak,
      readyToExit: greenStreak >= QUARANTINE_EXIT_RUNS,
    });
  }
  return quarantined.sort((a, b) => b.ageDays - a.ageDays);
}

/** M1–M7 values and statuses at the end of `history` (no trends). */
export function computeSnapshot(history, { cases = [], registerBugs = [], now } = {}) {
  const suites = groupBySuite(history);
  const nowIso =
    now ??
    history
      .map((r) => r.startedAt)
      .sort()
      .at(-1) ??
    new Date().toISOString();
  const pickWorst = (rows, key) =>
    rows.reduce(
      (worst, row) => (!worst || RANK[row.status] > RANK[worst.status] ? row : worst),
      null,
    ) ?? { [key]: null, status: STATUS.NA };

  // M1 — pass rate of each suite's latest run
  const passRows = [...suites].map(([suite, runs]) => {
    const value = runPassRate(runs.at(-1));
    return { suite, value, status: thresholdStatus(value, THRESHOLDS.passRate) };
  });
  const passWorst = passRows.length
    ? [...passRows].sort((a, b) => (a.value ?? 1) - (b.value ?? 1))[0]
    : { value: null, status: STATUS.NA };

  // M2 — flaky ÷ executed over each suite's last 14 runs
  const flakyRows = [...suites].map(([suite, runs]) => {
    const window = runs.slice(-WINDOW_RUNS);
    const executed = sum(window.map((r) => executedCount(r.counts)));
    const value = executed ? sum(window.map((r) => r.counts.flaky ?? 0)) / executed : null;
    return {
      suite,
      value,
      runs: window.length,
      status: thresholdStatus(value, THRESHOLDS.flakyRate),
    };
  });
  const flakyWorst = flakyRows.length
    ? [...flakyRows].sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0]
    : { value: null, status: STATUS.NA };

  // M3 — tests most often flaky in their suite's last 14 runs
  const flaky = flakyTests(suites);
  const maxFlaky = suites.size ? (flaky[0]?.flaky ?? 0) : null;

  // M4 — failure cause mix, latest triaged week vs the previous triaged week
  const weeks = weeklyCauseMix(history);
  const triagedWeeks = weeks.filter((week) => triagedTotal(week) > 0);
  const [previousWeek, currentWeek] =
    triagedWeeks.slice(-2).length === 2 ? triagedWeeks.slice(-2) : [undefined, triagedWeeks.at(-1)];
  const regressionShare = currentWeek ? share(currentWeek, 'REGRESSION_DEFECT') : null;
  const previousRegressionShare = previousWeek ? share(previousWeek, 'REGRESSION_DEFECT') : null;
  let causeStatus = STATUS.NA;
  if (currentWeek) {
    causeStatus =
      previousRegressionShare !== null && regressionShare > previousRegressionShare + EPSILON
        ? STATUS.AMBER
        : STATUS.GREEN;
  }
  const dominant = currentWeek
    ? [...TRIAGE_CLASSES].sort((a, b) => currentWeek[b] - currentWeek[a])[0]
    : null;

  // M5 — automation coverage per priority (catalogue)
  const coverageRows = PRIORITIES.map((priority) => {
    const ofPriority = cases.filter((c) => c.priority === priority);
    const automated = ofPriority.filter((c) => c.automation === 'automated').length;
    const value = ofPriority.length ? automated / ofPriority.length : null;
    return {
      priority,
      automated,
      total: ofPriority.length,
      manual: ofPriority.filter((c) => c.automation === 'manual').length,
      planned: ofPriority.filter((c) => c.automation === 'planned').length,
      notAutomatable: ofPriority.filter((c) => c.automation === 'not-automatable').length,
      value,
    };
  });
  const p1 = coverageRows.find((row) => row.priority === 'P1');
  const manualP1 = cases
    .filter((c) => c.priority === 'P1' && ['manual', 'planned'].includes(c.automation))
    // Run by hand today first, then the planned backlog
    .sort((a, b) => a.automation.localeCompare(b.automation) || a.id.localeCompare(b.id));

  // M6 — duration p95 of the last 14 runs vs the 14 before (same test selection)
  const durationRows = [...suites].map(([suite, runs]) => durationRow(suite, runs));
  const durationWorst = pickWorst(
    durationRows.filter((row) => row.increase !== null),
    'increase',
  );

  // M7 — open known app bugs and their age
  const bugs = openKnownBugs(suites, registerBugs, nowIso);
  const oldest = bugs[0]?.ageDays ?? 0;
  const bugStatus =
    oldest > KNOWN_BUG_MAX_AGE_DAYS
      ? STATUS.RED
      : thresholdStatus(bugs.length, THRESHOLDS.knownBugs);

  return {
    now: nowIso,
    suites: [...suites.keys()],
    runs: history.length,
    M1: {
      value: passWorst.value,
      suite: passWorst.suite,
      status: passWorst.status,
      rows: passRows,
    },
    M2: {
      value: flakyWorst.value,
      suite: flakyWorst.suite,
      status: flakyWorst.status,
      rows: flakyRows,
    },
    M3: {
      value: maxFlaky,
      status: thresholdStatus(maxFlaky, THRESHOLDS.flakyRuns),
      tests: flaky,
      repeatOffenders: flaky.filter((t) => t.flaky > THRESHOLDS.flakyRuns.amber),
    },
    M4: {
      value: regressionShare,
      previous: previousRegressionShare,
      status: causeStatus,
      week: currentWeek,
      dominant,
      weeks,
    },
    M5: {
      value: p1?.value ?? null,
      status: thresholdStatus(p1?.value ?? null, THRESHOLDS.p1Coverage),
      rows: coverageRows,
      manualP1,
    },
    M6: {
      value: durationWorst.increase ?? null,
      suite: durationWorst.suite,
      status: durationWorst.status,
      rows: durationRows,
    },
    M7: {
      value: bugs.length,
      oldestDays: bugs.length ? oldest : null,
      status: bugStatus,
      bugs,
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Trends

const TREND_EPSILON = { M1: 0.001, M2: 0.001, M3: 0, M5: 0.001, M6: 0.02, M7: 0 };
const HIGHER_IS_BETTER = {
  M1: true,
  M2: false,
  M3: false,
  M4: false,
  M5: true,
  M6: false,
  M7: false,
};

/** Trend of a value vs its previous value; null (shown as n/a) when there is nothing to compare. */
export function trend(metric, current, previous) {
  if (current === null || current === undefined || previous === null || previous === undefined) {
    return null;
  }
  const delta = current - previous;
  const flat = Math.abs(delta) <= (TREND_EPSILON[metric] ?? 0) + EPSILON;
  return {
    previous,
    delta,
    direction: flat ? 'flat' : delta > 0 ? 'up' : 'down',
    better: flat ? null : delta > 0 === HIGHER_IS_BETTER[metric],
  };
}

export const trendArrow = (t) => (!t ? 'n/a' : { up: '↑', down: '↓', flat: '→' }[t.direction]);

/**
 * Trends compare each metric with its value TREND_RUNS runs ago. Only suites with more than
 * TREND_RUNS runs take part (on both sides), so a new suite cannot fake a trend; with no such
 * suite every trend is n/a.
 */
function computeTrends(history, snapshot, context) {
  const suites = groupBySuite(history);
  const eligible = [...suites].filter(([, runs]) => runs.length > TREND_RUNS);
  const trends = Object.fromEntries(Object.keys(METRICS).map((id) => [id, null]));
  trends.M4 = trend('M4', snapshot.M4.value, snapshot.M4.previous);
  if (!eligible.length) return trends;

  const currentRuns = eligible.flatMap(([, runs]) => runs);
  const priorRuns = eligible.flatMap(([, runs]) => runs.slice(0, -TREND_RUNS));
  const priorNow = priorRuns
    .map((r) => r.startedAt)
    .sort()
    .at(-1);
  const current = computeSnapshot(currentRuns, { ...context, now: snapshot.now });
  const prior = computeSnapshot(priorRuns, { ...context, now: priorNow });

  for (const id of ['M1', 'M2', 'M3', 'M6', 'M7'])
    trends[id] = trend(id, current[id].value, prior[id].value);
  const priorCoverage = [...priorRuns]
    .sort(byStart)
    .reverse()
    .find((r) => r.coverage)?.coverage?.P1;
  trends.M5 = priorCoverage?.total
    ? trend('M5', snapshot.M5.value, priorCoverage.automated / priorCoverage.total)
    : null;
  return trends;
}

// ---------------------------------------------------------------------------------------------
// Insights (rule-based: explainable and testable) and the manager one-liner

const insight = (severity, text, owner, action) => ({ severity, text, owner, action });
const shortName = (testId) => testId.split('::')[1] ?? testId;

export function buildInsights(metrics, trends, quarantine) {
  const insights = [];
  const { M1, M2, M3, M4, M5, M6, M7 } = metrics;

  for (const row of M1.rows.filter((r) => r.status === STATUS.RED || r.status === STATUS.AMBER)) {
    insights.push(
      insight(
        row.status,
        `Pass rate in ${row.suite} was ${formatPercent(row.value)} in the latest run (target ≥ 98%).`,
        METRICS.M1.owner,
        'triage the failures before the next merge',
      ),
    );
  }

  const flakyTrend = trends.M2;
  if (flakyTrend && flakyTrend.previous > 0 && M2.value / flakyTrend.previous > FLAKY_RISE_RATIO) {
    insights.push(
      insight(
        M2.status === STATUS.GREEN ? STATUS.AMBER : M2.status,
        `Flaky rate rose to ${formatPercent(M2.value)} in ${M2.suite} (↑ from ${formatPercent(flakyTrend.previous)} ${TREND_RUNS} runs ago).`,
        METRICS.M2.owner,
        'fix or quarantine the top flaky tests within 2 days',
      ),
    );
  } else if (M2.status === STATUS.RED || M2.status === STATUS.AMBER) {
    insights.push(
      insight(
        M2.status,
        `Flaky rate is ${formatPercent(M2.value)} in ${M2.suite} over the last ${WINDOW_RUNS} runs (target ≤ 2%).`,
        METRICS.M2.owner,
        'fix or quarantine the top flaky tests within 2 days',
      ),
    );
  }

  if (M3.repeatOffenders.length) {
    const top = M3.repeatOffenders
      .slice(0, 3)
      .map((t) => `${t.tc ?? shortName(t.id)} (${t.flaky}/${t.runs})`)
      .join(', ');
    insights.push(
      insight(
        STATUS.RED,
        `${plural(M3.repeatOffenders.length, 'test')} flaky in ≥ 3 of the last ${WINDOW_RUNS} runs: ${top}.`,
        METRICS.M3.owner,
        'tag @quarantine in a PR and fix; the tag comes off after 10 green nightly runs',
      ),
    );
  }

  if (M4.week && M4.dominant) {
    const dominantShare = share(M4.week, M4.dominant);
    if (M4.dominant === 'TRANSIENT_RPC' && dominantShare > 0.5) {
      insights.push(
        insight(
          STATUS.AMBER,
          `${formatPercent(dominantShare)} of failures in ${M4.week.week} were transient RPC errors: an infrastructure problem, not a product one.`,
          METRICS.M4.owner,
          'raise RPC stability with the infra owner before adding retries',
        ),
      );
    } else if (M4.dominant === 'DOM_SELECTOR_DRIFT' && dominantShare > 0.5) {
      insights.push(
        insight(
          STATUS.AMBER,
          `${formatPercent(dominantShare)} of failures in ${M4.week.week} were selector drift: test-design debt.`,
          METRICS.M4.owner,
          'move the affected locators to roles / test ids in the page objects',
        ),
      );
    }
    if (M4.status === STATUS.AMBER) {
      insights.push(
        insight(
          STATUS.AMBER,
          `Regression defects are ${formatPercent(M4.value)} of triaged failures in ${M4.week.week} (↑ from ${formatPercent(M4.previous)}).`,
          METRICS.M4.owner,
          'review recent app changes with the Eng lead',
        ),
      );
    }
  }

  if (M5.status === STATUS.RED || M5.status === STATUS.AMBER) {
    const p1 = M5.rows.find((row) => row.priority === 'P1');
    const next = M5.manualP1
      .slice(0, 3)
      .map((c) => c.id)
      .join(', ');
    insights.push(
      insight(
        M5.status,
        `P1 automation coverage is ${formatPercent(M5.value)} (${p1.automated}/${p1.total}, target ≥ 90%)${next ? `; next to automate: ${next}` : ''}.`,
        METRICS.M5.owner,
        'schedule the top manual P1 cases for automation',
      ),
    );
  }

  for (const row of M6.rows.filter((r) => r.status === STATUS.RED)) {
    insights.push(
      insight(
        STATUS.RED,
        `${row.suite} duration p95 is ${formatDuration(row.p95)}, +${Math.round(row.increase * 100)}% on its baseline of ${formatDuration(row.baselineP95)}.`,
        METRICS.M6.owner,
        'profile the slowest tests and rebalance workers',
      ),
    );
  }

  const staleBugs = M7.bugs.filter((bug) => bug.ageDays > KNOWN_BUG_MAX_AGE_DAYS);
  if (staleBugs.length) {
    insights.push(
      insight(
        STATUS.RED,
        `${plural(staleBugs.length, 'known app bug')} open for more than ${KNOWN_BUG_MAX_AGE_DAYS} days (oldest: ${staleBugs[0].label}, ${staleBugs[0].ageDays} days).`,
        METRICS.M7.owner,
        'prioritise the fix or accept the risk explicitly',
      ),
    );
  } else if (M7.status !== STATUS.GREEN && M7.value > 0) {
    insights.push(
      insight(
        M7.status,
        `${plural(M7.value, 'known app bug')} tracked by the suite; the oldest is ${M7.oldestDays} days old.`,
        METRICS.M7.owner,
        'prioritise the fixes before they reach 30 days',
      ),
    );
  }

  for (const test of quarantine.filter((q) => q.readyToExit)) {
    insights.push(
      insight(
        STATUS.GREEN,
        `${test.tc ?? shortName(test.id)} has been green in ${test.greenStreak} consecutive runs while quarantined.`,
        METRICS.M3.owner,
        'remove the @quarantine tag so it gates PRs again',
      ),
    );
  }

  if (!insights.length) {
    insights.push(
      insight(
        STATUS.GREEN,
        'All metrics are within their thresholds.',
        'QA lead',
        'no action; keep the weekly 10-minute review',
      ),
    );
  }
  return insights.sort((a, b) => RANK[b.severity] - RANK[a.severity]);
}

function headlinePhrase(id, metrics, trends) {
  const m = metrics[id];
  const t = trends[id];
  const arrow =
    t && t.direction !== 'flat'
      ? ` (${trendArrow(t)} from ${id === 'M7' ? t.previous : formatPercent(t.previous)})`
      : '';
  switch (id) {
    case 'M1':
      return `pass rate ${formatPercent(m.value)} in ${m.suite}${arrow}`;
    case 'M2': {
      const driven = metrics.M3.repeatOffenders.length
        ? `, driven by ${plural(metrics.M3.repeatOffenders.length, 'repeatedly flaky test')}`
        : '';
      return `flaky rate ${formatPercent(m.value)} in ${m.suite}${arrow}${driven}`;
    }
    case 'M5':
      return `P1 automation coverage ${formatPercent(m.value)}${arrow}`;
    default:
      return `${plural(m.value, 'open known app bug')}${m.oldestDays !== null ? `, oldest ${m.oldestDays} days` : ''}`;
  }
}

/** Overall health (worst headline metric) and a one-sentence status for management. */
export function buildHealth(metrics, trends) {
  const status = metrics.runs
    ? worstStatus(HEADLINE_METRICS.map((id) => metrics[id].status))
    : STATUS.NA;
  const label = status === STATUS.NA ? 'No data' : status[0].toUpperCase() + status.slice(1);
  if (status === STATUS.NA) {
    return { status, sentence: 'No data — no test runs have been collected yet.' };
  }
  if (status === STATUS.GREEN) {
    const parts = HEADLINE_METRICS.filter((id) => metrics[id].status !== STATUS.NA).map((id) =>
      headlinePhrase(id, metrics, trends),
    );
    return {
      status,
      sentence: `${label} — all headline metrics within thresholds: ${parts.join(', ')}.`,
    };
  }
  const offenders = HEADLINE_METRICS.filter((id) => metrics[id].status === status);
  const others = HEADLINE_METRICS.filter(
    (id) => metrics[id].status !== status && RANK[metrics[id].status] > RANK[STATUS.GREEN],
  );
  const tail = others.length ? `; ${plural(others.length, 'other metric')} amber` : '';
  return {
    status,
    sentence: `${label} — ${offenders.map((id) => headlinePhrase(id, metrics, trends)).join('; ')}${tail}.`,
  };
}

// ---------------------------------------------------------------------------------------------
// Chart series

function chartSeries(suites, valueOf) {
  return [...suites].map(([suite, runs]) => ({
    suite,
    points: runs
      .slice(-CHART_RUNS)
      .map((run) => ({ at: run.startedAt, runId: run.runId, value: valueOf(run) }))
      .filter((point) => point.value !== null),
  }));
}

function durationSeries(suites) {
  return [...suites].map(([suite, runs]) => {
    const scope = runs.at(-1).scope ?? 'full';
    const sameScope = runs.filter((run) => (run.scope ?? 'full') === scope);
    const start = Math.max(sameScope.length - CHART_RUNS, 0);
    return {
      suite: scope === 'full' ? suite : `${suite} (${scope})`,
      points: sameScope.slice(start).map((run, index) => ({
        at: run.startedAt,
        runId: run.runId,
        value: percentile(
          sameScope
            .slice(Math.max(start + index + 1 - WINDOW_RUNS, 0), start + index + 1)
            .map((r) => r.durationMs),
          0.95,
        ),
      })),
    };
  });
}

/** Everything the dashboard and the CI summary render. */
export function computeDashboard(history, context = {}) {
  const snapshot = computeSnapshot(history, context);
  const trends = computeTrends(history, snapshot, context);
  const quarantine = quarantinedTests(history, snapshot.now);
  const suites = groupBySuite(history);
  return {
    ...snapshot,
    trends,
    quarantine,
    health: buildHealth(snapshot, trends),
    insights: buildInsights(snapshot, trends, quarantine),
    sample: history.some((record) => record.sample),
    charts: {
      passRate: chartSeries(suites, runPassRate),
      flakyRate: chartSeries(suites, runFlakyRate),
      duration: durationSeries(suites),
      causeMix: snapshot.M4.weeks.slice(-CHART_WEEKS),
    },
  };
}
