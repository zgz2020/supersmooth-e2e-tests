/**
 * Evaluates the triage classifier against the labelled dataset (tests/eval/triage/dataset).
 *
 *   pnpm eval:triage                                     # heuristic only (free, deterministic)
 *   pnpm eval:triage --provider gemini                   # needs GEMINI_API_KEY
 *   pnpm eval:triage --provider all --repeats 3 --min-accuracy 0.8
 *
 * Options: --dataset <dir>, --out <dir> (default eval-reports), --delay-ms <n> between Gemini
 * calls (default 13000: stays under the Gemini free tier's 5 requests per minute). Writes eval-reports/triage-eval-<timestamp>.json and
 * triage-eval-latest.md, and appends the markdown to $GITHUB_STEP_SUMMARY when set.
 * Exits 1 when a provider's accuracy is below --min-accuracy.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import dotenv from 'dotenv';
import { CLASSES, DEFAULT_GEMINI_MODEL, classifyFailure } from '../qa-agent/triage-core.js';
import { DEFAULT_DATASET_DIR, datasetComposition, loadDataset } from './dataset.js';
import {
  calibration,
  classificationMetrics,
  consistency,
  fallbackRate,
  percentile,
} from './metrics.js';

export const PROVIDERS = ['heuristic', 'gemini'];
/** Hard cap on repeats, so one run costs at most MAX_REPEATS × dataset size Gemini calls. */
export const MAX_REPEATS = 3;
/** Stop Gemini after this many fallbacks in a row: the quota is gone or the API is down. */
export const MAX_CONSECUTIVE_FALLBACKS = 5;

/** Thrown when Gemini keeps falling back, so no Gemini score can be measured. */
export class ProviderUnavailableError extends Error {
  constructor(reasons, calls) {
    super(
      `Gemini evaluation stopped after ${MAX_CONSECUTIVE_FALLBACKS} fallbacks in a row ` +
        `(${[...new Set(reasons)].join(', ')}; ${calls} API calls made). No Gemini score was measured.`,
    );
    this.name = 'ProviderUnavailableError';
    this.calls = calls;
  }
}

export function parseArgs(argv) {
  const args = { provider: 'heuristic', repeats: 1, minAccuracy: null, delayMs: 13000 };
  for (let i = 0; i < argv.length; i++) {
    const [key, inline] = argv[i].replace(/^--/, '').split('=');
    const value = inline ?? argv[++i];
    if (key === 'provider') args.provider = value;
    else if (key === 'repeats') args.repeats = Number(value);
    else if (key === 'min-accuracy') args.minAccuracy = Number(value);
    else if (key === 'delay-ms') args.delayMs = Number(value);
    else if (key === 'dataset') args.dataset = value;
    else if (key === 'out') args.out = value;
  }
  if (!['heuristic', 'gemini', 'all'].includes(args.provider)) {
    throw new Error(`--provider must be heuristic, gemini or all (got ${args.provider})`);
  }
  if (!Number.isInteger(args.repeats) || args.repeats < 1) {
    throw new Error('--repeats must be a positive integer');
  }
  args.repeats = Math.min(args.repeats, MAX_REPEATS);
  return args;
}

/**
 * Runs one provider over every case. The heuristic is deterministic, so it runs once.
 * @returns {Promise<Array<object>>} one row per case and repeat
 */
export async function runProvider(provider, cases, options = {}) {
  const { repeats = 1, apiKey, delayMs = 0, classify = classifyFailure } = options;
  const runs = provider === 'heuristic' ? 1 : Math.min(repeats, MAX_REPEATS);
  const maxCalls = MAX_REPEATS * cases.length;
  const rows = [];
  let calls = 0;
  const streak = [];
  for (let repeat = 1; repeat <= runs; repeat++) {
    for (const testCase of cases) {
      if (provider === 'gemini') {
        if (calls >= maxCalls) throw new Error(`Gemini call budget (${maxCalls}) exceeded`);
        if (calls > 0 && delayMs) await sleep(delayMs);
        calls += 1;
      }
      const started = performance.now();
      const result = await classify(testCase.failure, { provider, apiKey });
      rows.push({
        caseId: testCase.id,
        repeat,
        truth: testCase.label,
        predicted: result.classification,
        confidence: Number(result.confidenceScore) || 0,
        source: result.source,
        fallbackReason: result.fallbackReason ?? null,
        latencyMs: Math.round(performance.now() - started),
      });
      if (provider === 'gemini') {
        if (result.fallbackReason) streak.push(result.fallbackReason);
        else streak.length = 0;
        if (streak.length >= MAX_CONSECUTIVE_FALLBACKS)
          throw new ProviderUnavailableError(streak, calls);
      }
    }
  }
  return rows;
}

/** Metrics for one provider. Main metrics use the first repeat; repeats feed consistency. */
export function summarise(provider, cases, rows) {
  const byId = new Map(cases.map((c) => [c.id, c]));
  const first = rows.filter((r) => r.repeat === 1);
  const pairs = (list) => list.map((r) => ({ truth: r.truth, predicted: r.predicted }));
  const accuracyOf = (list) => classificationMetrics(pairs(list), CLASSES).accuracy;
  const repeats = Math.max(...rows.map((r) => r.repeat));

  const summary = {
    provider,
    model: provider === 'gemini' ? DEFAULT_GEMINI_MODEL : null,
    repeats,
    ...classificationMetrics(pairs(first), CLASSES),
    byDifficulty: Object.fromEntries(
      ['easy', 'hard'].map((d) => [
        d,
        accuracyOf(first.filter((r) => byId.get(r.caseId).difficulty === d)),
      ]),
    ),
    calibration: calibration(
      first.map((r) => ({ confidence: r.confidence, correct: r.truth === r.predicted })),
    ),
    accuracyByRepeat: Array.from({ length: repeats }, (_, i) =>
      accuracyOf(rows.filter((r) => r.repeat === i + 1)),
    ),
    consistency: consistency(
      cases.map((c) => rows.filter((r) => r.caseId === c.id).map((r) => r.predicted)),
    ),
    calls: provider === 'gemini' ? rows.length : 0,
    latencyMs: {
      p50: percentile(
        rows.map((r) => r.latencyMs),
        0.5,
      ),
      p95: percentile(
        rows.map((r) => r.latencyMs),
        0.95,
      ),
    },
    worst: first
      .filter((r) => r.truth !== r.predicted)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5)
      .map((r) => ({
        ...r,
        notes: byId.get(r.caseId).notes,
        testTitle: byId.get(r.caseId).failure.testTitle,
      })),
  };

  if (provider === 'gemini') {
    summary.fallback = fallbackRate(rows);
    summary.fallbackReasons = rows
      .filter((r) => r.fallbackReason)
      .reduce((acc, r) => ({ ...acc, [r.fallbackReason]: (acc[r.fallbackReason] ?? 0) + 1 }), {});
    // Gemini-only scores: fallback answers are the heuristic's, so they would contaminate these
    const clean = first.filter((r) => r.source === 'gemini');
    summary.geminiOnly = { cases: clean.length, accuracy: accuracyOf(clean) };
  }
  return summary;
}

const pct = (x) => (x === null || x === undefined ? 'n/a' : `${(x * 100).toFixed(1)}%`);
const num = (x, digits = 2) => (x === null || x === undefined ? 'n/a' : x.toFixed(digits));

export function renderMarkdown({ generatedAt, composition, summaries, skipped = [] }) {
  const out = [
    '## 🧪 Triage classifier evaluation',
    '',
    `Generated ${generatedAt} · dataset: **${composition.total}** cases (` +
      CLASSES.map((c) => `${c} ${composition.byLabel[c]}`).join(', ') +
      `; hard ${composition.byDifficulty.hard}, synthetic ${composition.bySource.synthetic})`,
    '',
    '| Provider | Accuracy | Macro-F1 | Easy | Hard | Consistency | Fallback | API calls | Latency p50 / p95 |',
    '| :-- | --: | --: | --: | --: | --: | --: | --: | --: |',
    ...summaries.map(
      (s) =>
        `| ${s.provider}${s.model ? ` (\`${s.model}\`)` : ''} | **${pct(s.accuracy)}** | ${num(s.macroF1)} | ${pct(s.byDifficulty.easy)} | ${pct(s.byDifficulty.hard)} | ` +
        `${s.consistency.cases ? `${pct(s.consistency.rate)} (${s.repeats} runs)` : 'n/a (1 run)'} | ` +
        `${s.fallback ? `${pct(s.fallback.rate)} (${s.fallback.fellBack}/${s.fallback.calls})` : 'n/a'} | ${s.calls} | ${s.latencyMs.p50} / ${s.latencyMs.p95} ms |`,
    ),
    ...skipped.map((note) => `\n> ${note}`),
  ];

  for (const s of summaries) {
    out.push('', `### ${s.provider}`, '');
    if (s.fallback?.fellBack) {
      out.push(
        `> ⚠️ ${s.fallback.fellBack} of ${s.fallback.calls} Gemini calls fell back to the heuristic ` +
          `(${Object.entries(s.fallbackReasons)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ')}). ` +
          `Gemini-only accuracy on the ${s.geminiOnly.cases} cases it answered: **${pct(s.geminiOnly.accuracy)}**.`,
        '',
      );
    }
    out.push(
      '**Confusion matrix** (rows: true label, columns: predicted)',
      '',
      `| | ${CLASSES.join(' | ')} |`,
      `| :-- | ${CLASSES.map(() => '--:').join(' | ')} |`,
      ...CLASSES.map(
        (t) =>
          `| **${t}** | ${CLASSES.map((p) => (t === p ? `**${s.matrix[t][p]}**` : s.matrix[t][p])).join(' | ')} |`,
      ),
      '',
      '| Class | Precision | Recall | F1 | Support |',
      '| :-- | --: | --: | --: | --: |',
      ...CLASSES.map((c) => {
        const m = s.perClass[c];
        return `| ${c} | ${pct(m.precision)} | ${pct(m.recall)} | ${num(m.f1)} | ${m.support} |`;
      }),
      '',
      '**Calibration** (accuracy per stated confidence)',
      '',
      '| Confidence | Cases | Accuracy | Mean stated confidence |',
      '| :-- | --: | --: | --: |',
      ...s.calibration.map(
        (b) =>
          `| ${b.bucket} | ${b.count} | ${pct(b.accuracy)} | ${b.meanConfidence === null ? 'n/a' : `${b.meanConfidence.toFixed(0)}%`} |`,
      ),
    );
    if (s.repeats > 1) {
      out.push('', `Accuracy per run: ${s.accuracyByRepeat.map(pct).join(', ')}`);
    }
    out.push('', `**Worst misclassifications** (most confident first)`, '');
    if (!s.worst.length) out.push('None 🎉');
    for (const w of s.worst) {
      out.push(
        `- **${w.caseId}** · true \`${w.truth}\` · predicted \`${w.predicted}\` (${w.confidence}%, ${w.source}) · _${w.testTitle}_  \n  ${w.notes}`,
      );
    }
  }
  return `${out.join('\n')}\n`;
}

async function main() {
  dotenv.config({ quiet: true });
  const args = parseArgs(process.argv.slice(2));
  const cases = loadDataset(args.dataset || DEFAULT_DATASET_DIR);
  const apiKey = process.env.GEMINI_API_KEY;
  const providers = args.provider === 'all' ? PROVIDERS : [args.provider];
  const skipped = [];

  const summaries = [];
  const rawRuns = {};
  let apiCalls = 0;
  for (const provider of providers) {
    if (provider === 'gemini' && !apiKey) {
      if (args.provider === 'gemini') {
        console.error('GEMINI_API_KEY is not set: cannot evaluate the gemini provider.');
        process.exit(2);
      }
      skipped.push('Gemini was not evaluated: GEMINI_API_KEY is not set.');
      continue;
    }
    console.log(
      `Evaluating ${provider} on ${cases.length} cases (${provider === 'gemini' ? `${args.repeats} run(s)` : 'deterministic'})...`,
    );
    let rows;
    try {
      rows = await runProvider(provider, cases, {
        repeats: args.repeats,
        apiKey,
        delayMs: args.delayMs,
      });
    } catch (err) {
      if (!(err instanceof ProviderUnavailableError)) throw err;
      console.warn(err.message);
      apiCalls += err.calls;
      skipped.push(err.message);
      continue;
    }
    rawRuns[provider] = rows;
    summaries.push(summarise(provider, cases, rows));
  }

  const generatedAt = new Date().toISOString();
  const report = { generatedAt, composition: datasetComposition(cases), summaries, skipped };
  const markdown = renderMarkdown(report);

  const outDir = path.resolve(args.out || 'eval-reports');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = generatedAt.replace(/[:.]/g, '-');
  fs.writeFileSync(
    path.join(outDir, `triage-eval-${stamp}.json`),
    JSON.stringify({ ...report, runs: rawRuns }, null, 2),
  );
  fs.writeFileSync(path.join(outDir, 'triage-eval-latest.md'), markdown);
  if (process.env.GITHUB_STEP_SUMMARY)
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n${markdown}`);

  console.log(`\n${markdown}`);
  apiCalls += summaries.reduce((sum, s) => sum + s.calls, 0);
  console.log(`Gemini API calls: ${apiCalls}`);
  console.log(
    `Report: ${path.relative(process.cwd(), path.join(outDir, 'triage-eval-latest.md'))}`,
  );

  if (args.minAccuracy !== null) {
    const failing = summaries.filter((s) => (s.accuracy ?? 0) < args.minAccuracy);
    for (const s of failing) {
      console.error(
        `❌ ${s.provider} accuracy ${pct(s.accuracy)} is below --min-accuracy ${pct(args.minAccuracy)}`,
      );
    }
    if (failing.length) process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
