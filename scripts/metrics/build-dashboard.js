#!/usr/bin/env node
/**
 * Builds the quality dashboard (single self-contained HTML file) and the CI markdown summary from
 * the metrics history, the test-case catalogue and the known app bugs register.
 *
 * Usage:
 *   pnpm metrics:dashboard                         # .metrics/history.jsonl -> .metrics/quality-dashboard.html
 *   pnpm metrics:dashboard --sample                # SAMPLE data (demo / docs screenshot)
 *   pnpm metrics:summary                           # markdown summary on stdout
 *   node scripts/metrics/build-dashboard.js --history metrics-data/metrics/history.jsonl --out quality-dashboard.html
 *
 * Options:
 *   --history <file>   history file (default .metrics/history.jsonl)
 *   --out <file>       dashboard file (default .metrics/quality-dashboard.html)
 *   --summary          print the markdown summary to stdout instead of writing the dashboard
 *   --sample           use generated sample data (clearly labelled) instead of the history file
 *   --repo-url <url>   base for case links (default: this GitHub repo in CI, relative paths locally)
 *
 * See docs/quality-metrics.md.
 */
import console from 'node:console';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { REPO_ROOT, loadCatalogue } from '../tc/catalogue.js';
import { headingAnchor } from '../tc/case-index.js';
import { DEFAULT_HISTORY_PATH, readHistory } from './history.js';
import {
  METRICS,
  STATUS,
  WINDOW_RUNS,
  computeDashboard,
  formatPercent,
  parseKnownBugsDoc,
  trendArrow,
} from './model.js';
import { renderDashboardHtml } from './render-html.js';
import { sampleHistory } from './sample-history.js';

export const KNOWN_BUGS_DOC = path.join(REPO_ROOT, 'docs', 'known-app-bugs.md');
const DEFAULT_OUT = path.join(REPO_ROOT, '.metrics', 'quality-dashboard.html');
const STATUS_EMOJI = { green: '🟢', amber: '🟡', red: '🔴', 'n/a': '⚪' };

const percentValue = (v) => formatPercent(v);
const signedPercent = (v) =>
  v === null || v === undefined ? 'n/a' : `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;

/** Rows of the summary table: metric · value · status · trend. */
export function summaryRows(d) {
  const p1 = d.M5.rows.find((r) => r.priority === 'P1');
  const count = (v) => (v === null || v === undefined ? 'n/a' : String(v));
  const rows = [
    ['M1', `${percentValue(d.M1.value)}${d.M1.suite ? ` (${d.M1.suite})` : ''}`, percentValue],
    ['M2', `${percentValue(d.M2.value)}${d.M2.suite ? ` (${d.M2.suite})` : ''}`, percentValue],
    [
      'M3',
      d.M3.value === null
        ? 'n/a'
        : `max ${d.M3.value}/${WINDOW_RUNS} runs · ${d.M3.repeatOffenders.length} test(s) ≥ 3`,
      count,
    ],
    [
      'M4',
      d.M4.value === null
        ? 'n/a'
        : `${percentValue(d.M4.value)} regression · mostly ${d.M4.dominant}`,
      percentValue,
    ],
    [
      'M5',
      `${percentValue(d.M5.value)}${p1 ? ` (${p1.automated}/${p1.total})` : ''}`,
      percentValue,
    ],
    ['M6', `${signedPercent(d.M6.value)}${d.M6.suite ? ` (${d.M6.suite})` : ''}`, signedPercent],
    [
      'M7',
      `${d.M7.value}${d.M7.oldestDays !== null ? ` · oldest ${d.M7.oldestDays} days` : ''}`,
      count,
    ],
  ];
  return rows.map(([id, value, format]) => {
    const t = d.trends[id];
    return {
      id,
      name: METRICS[id].name,
      value,
      status: d[id].status,
      trend: t ? `${trendArrow(t)} from ${format(t.previous)}` : 'n/a',
    };
  });
}

export function renderSummary(d) {
  const lines = [
    `## ${STATUS_EMOJI[d.health.status]} Quality health: ${d.health.status === STATUS.NA ? 'no data' : d.health.status}`,
    '',
    d.sample ? '> ⚠️ **SAMPLE DATA** — generated for illustration, not real test runs.\n' : '',
    `> ${d.health.sentence}`,
    '',
    '| Metric | Value | Status | Trend (vs 7 runs ago) |',
    '| :-- | :-- | :-- | :-- |',
    ...summaryRows(d).map(
      (r) =>
        `| ${r.id} ${r.name} | ${r.value} | ${STATUS_EMOJI[r.status]} ${r.status} | ${r.trend} |`,
    ),
    '',
    '### 💡 Insights',
    '',
    ...d.insights.map(
      (i) => `- ${STATUS_EMOJI[i.severity]} ${i.text} **${i.owner}** → ${i.action}.`,
    ),
    '',
    `_${d.runs} runs · ${d.suites.length} suites · full dashboard in the \`quality-dashboard\` artifact · model: docs/quality-metrics.md_`,
    '',
  ];
  return lines.filter((line, i) => line !== '' || lines[i - 1] !== '').join('\n');
}

/** Link to a case heading: GitHub URL when a base is given, else relative to the output file. */
export function caseLinker(cases, { repoUrl, outFile }) {
  const byId = new Map(cases.map((c) => [c.id, c]));
  return (id) => {
    const testCase = byId.get(id);
    if (!testCase) return undefined;
    const anchor = headingAnchor(`${testCase.id}: ${testCase.title}`);
    if (repoUrl) return `${repoUrl.replace(/\/$/, '')}/${testCase.file}#${anchor}`;
    const relative = path.relative(path.dirname(outFile), path.join(REPO_ROOT, testCase.file));
    return `${relative.split(path.sep).join('/')}#${anchor}`;
  };
}

function parseArgs(argv) {
  const args = { history: DEFAULT_HISTORY_PATH, out: DEFAULT_OUT, summary: false, sample: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--history') args.history = path.resolve(argv[++i]);
    else if (argv[i] === '--out') args.out = path.resolve(argv[++i]);
    else if (argv[i] === '--repo-url') args.repoUrl = argv[++i];
    else if (argv[i] === '--summary') args.summary = true;
    else if (argv[i] === '--sample') args.sample = true;
  }
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_SHA } = process.env;
  if (!args.repoUrl && GITHUB_SERVER_URL && GITHUB_REPOSITORY) {
    args.repoUrl = `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/blob/${GITHUB_SHA ?? 'main'}`;
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const { cases } = loadCatalogue();
  const history = args.sample ? sampleHistory(cases) : readHistory(args.history);
  const registerBugs =
    args.sample || !fs.existsSync(KNOWN_BUGS_DOC)
      ? []
      : parseKnownBugsDoc(fs.readFileSync(KNOWN_BUGS_DOC, 'utf-8'));
  const dashboard = computeDashboard(history, {
    cases,
    registerBugs,
    now: args.sample ? undefined : new Date().toISOString(),
  });

  if (args.summary) {
    console.log(renderSummary(dashboard));
    return;
  }
  const html = renderDashboardHtml(dashboard, {
    caseUrl: caseLinker(cases, { repoUrl: args.repoUrl, outFile: args.out }),
    generatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
  });
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, html);
  console.log(
    `${STATUS_EMOJI[dashboard.health.status]} ${dashboard.health.sentence}\n` +
      `📊 Dashboard written to ${path.relative(process.cwd(), args.out)} (${history.length} runs)`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    console.error(`❌ metrics:dashboard failed: ${error.message}`);
    process.exit(1);
  }
}
