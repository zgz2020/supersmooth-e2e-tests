/**
 * Renders the quality dashboard as one self-contained HTML file: inline CSS, hand-rolled inline
 * SVG charts, no scripts, fonts or network requests, so it opens offline from a CI artifact zip.
 *
 * Input is the object returned by computeDashboard() (scripts/metrics/model.js).
 */
import { TRIAGE_CLASSES } from './collect-run.js';
import {
  CHART_RUNS,
  METRICS,
  MIN_DURATION_RUNS,
  STATUS,
  THRESHOLDS,
  TREND_RUNS,
  WINDOW_RUNS,
  formatDuration,
  formatPercent,
  trendArrow,
} from './model.js';

/** Fixed colour slot per suite, so a suite keeps its colour in every chart and every run. */
const SUITE_ORDER = ['no-wallet', 'with-wallet', 'api', 'anvil', 'cross-browser'];
const SLOT_COUNT = 8;
const CAUSE_SLOTS = { TRANSIENT_RPC: 7, DOM_SELECTOR_DRIFT: 4, REGRESSION_DEFECT: 2 };
const STATUS_ICON = { green: '✓', amber: '!', red: '✕', 'n/a': '–' };
const STATUS_LABEL = { green: 'Green', amber: 'Amber', red: 'Red', 'n/a': 'No data' };

export const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function slotOf(suite, allSuites) {
  const base = suite.replace(/ \(.*\)$/, '');
  const known = SUITE_ORDER.indexOf(base);
  if (known >= 0) return known + 1;
  const extras = allSuites.filter((s) => !SUITE_ORDER.includes(s.replace(/ \(.*\)$/, '')));
  return Math.min(SUITE_ORDER.length + extras.indexOf(suite) + 1, SLOT_COUNT);
}

const badge = (status) =>
  `<span class="badge s-${status.replace('/', '')}"><span aria-hidden="true">${STATUS_ICON[status]}</span> ${STATUS_LABEL[status]}</span>`;

const dateLabel = (iso) => String(iso).slice(0, 10);

// ---------------------------------------------------------------------------------------------
// Charts

const W = 640;
const H = 240;
const PAD = { top: 16, right: 150, bottom: 28, left: 52 };

function lineChart({ id, title, caption, series, format, yMin, yMax, refs = [], allSuites }) {
  const points = series.flatMap((s) => s.points);
  if (!points.length) return emptyChart(title);
  const times = points.map((p) => Date.parse(p.at));
  const [t0, t1] = [Math.min(...times), Math.max(...times)];
  const x = (at) =>
    t1 === t0
      ? PAD.left + (W - PAD.left - PAD.right) / 2
      : PAD.left + ((Date.parse(at) - t0) / (t1 - t0)) * (W - PAD.left - PAD.right);
  const y = (value) =>
    PAD.top + (1 - (value - yMin) / (yMax - yMin || 1)) * (H - PAD.top - PAD.bottom);

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => yMin + f * (yMax - yMin));
  const grid = ticks
    .map(
      (tick) =>
        `<line class="grid" x1="${PAD.left}" x2="${W - PAD.right}" y1="${y(tick)}" y2="${y(tick)}"/>` +
        `<text class="tick" x="${PAD.left - 6}" y="${y(tick) + 4}" text-anchor="end">${escapeHtml(format(tick))}</text>`,
    )
    .join('');
  const refLines = refs
    .filter((ref) => ref.value >= yMin && ref.value <= yMax)
    .map(
      (ref) =>
        `<line class="ref" x1="${PAD.left}" x2="${W - PAD.right}" y1="${y(ref.value)}" y2="${y(ref.value)}"/>` +
        `<text class="ref-label" x="${W - PAD.right - 4}" y="${y(ref.value) - 4}" text-anchor="end">${escapeHtml(ref.label)}</text>`,
    )
    .join('');

  // Direct labels at line ends, nudged apart so they never overlap
  const ends = series
    .filter((s) => s.points.length)
    .map((s) => ({ suite: s.suite, y: y(s.points.at(-1).value) }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) ends[i].y = Math.max(ends[i].y, ends[i - 1].y + 13);
  // ...and kept inside the plot: push the stack back up from the baseline if it overflowed
  for (let i = ends.length - 1; i >= 0; i--) {
    const limit = i === ends.length - 1 ? H - PAD.bottom : ends[i + 1].y - 13;
    ends[i].y = Math.min(ends[i].y, limit);
  }

  const lines = series
    .filter((s) => s.points.length)
    .map((s) => {
      const slot = slotOf(s.suite, allSuites);
      const path = s.points
        .map((p, i) => `${i ? 'L' : 'M'}${x(p.at).toFixed(1)},${y(p.value).toFixed(1)}`)
        .join(' ');
      const last = s.points.at(-1);
      const hits = s.points
        .map(
          (p) =>
            `<circle class="hit" cx="${x(p.at).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="7"><title>${escapeHtml(`${s.suite} · ${dateLabel(p.at)} · run ${p.runId}: ${format(p.value)}`)}</title></circle>`,
        )
        .join('');
      const end = ends.find((e) => e.suite === s.suite);
      return (
        `<path class="line c${slot}" d="${path}"/>` +
        `<circle class="dot c${slot}" cx="${x(last.at).toFixed(1)}" cy="${y(last.value).toFixed(1)}" r="4"/>` +
        `<text class="end-label" x="${W - PAD.right + 8}" y="${end.y + 4}">${escapeHtml(s.suite)} ${escapeHtml(format(last.value))}</text>` +
        hits
      );
    })
    .join('');

  const axis =
    `<line class="axis" x1="${PAD.left}" x2="${W - PAD.right}" y1="${H - PAD.bottom}" y2="${H - PAD.bottom}"/>` +
    `<text class="tick" x="${PAD.left}" y="${H - 8}">${dateLabel(new Date(t0).toISOString())}</text>` +
    `<text class="tick" x="${W - PAD.right}" y="${H - 8}" text-anchor="end">${dateLabel(new Date(t1).toISOString())}</text>`;

  const table = chartTable(
    ['Suite', 'Run', 'Date', title],
    series.flatMap((s) =>
      s.points.map((p) => [s.suite, p.runId, dateLabel(p.at), format(p.value)]),
    ),
  );
  return figure(
    id,
    title,
    caption,
    `<svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${id}-t"><title id="${id}-t">${escapeHtml(title)}</title>${grid}${refLines}${axis}${lines}</svg>`,
    legend(
      series.filter((s) => s.points.length).map((s) => s.suite),
      allSuites,
    ),
    table,
  );
}

function stackedBars({ id, title, caption, weeks }) {
  if (!weeks.length) return emptyChart(title);
  const keys = [...TRIAGE_CLASSES, 'untriaged'];
  const totals = weeks.map((w) => keys.reduce((s, k) => s + w[k], 0));
  const max = Math.max(...totals, 1);
  const plotW = W - PAD.left - PAD.right;
  const band = plotW / weeks.length;
  const barW = Math.min(band * 0.6, 48);
  const y = (value) => (value / max) * (H - PAD.top - PAD.bottom);
  const bars = weeks
    .map((week, i) => {
      let top = H - PAD.bottom;
      const cx = PAD.left + band * i + band / 2;
      const segments = keys
        .filter((k) => week[k] > 0)
        .map((k) => {
          const h = y(week[k]);
          top -= h;
          const cls = k === 'untriaged' ? 'untriaged' : `c${CAUSE_SLOTS[k]}`;
          return `<rect class="seg ${cls}" x="${(cx - barW / 2).toFixed(1)}" y="${top.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(h, 1).toFixed(1)}" rx="2"><title>${escapeHtml(`${week.week} · ${k}: ${week[k]}`)}</title></rect>`;
        })
        .join('');
      return (
        segments +
        `<text class="tick" x="${cx}" y="${H - 10}" text-anchor="middle">${week.week.slice(5)}</text>` +
        `<text class="tick" x="${cx}" y="${top - 5}" text-anchor="middle">${totals[i]}</text>`
      );
    })
    .join('');
  const axis = `<line class="axis" x1="${PAD.left}" x2="${W - PAD.right}" y1="${H - PAD.bottom}" y2="${H - PAD.bottom}"/>`;
  const legendHtml = `<ul class="legend">${keys
    .map(
      (k) =>
        `<li><span class="swatch ${k === 'untriaged' ? 'untriaged' : `c${CAUSE_SLOTS[k]}`}"></span>${escapeHtml(k)}</li>`,
    )
    .join('')}</ul>`;
  const table = chartTable(
    ['Week', ...keys],
    weeks.map((w) => [w.week, ...keys.map((k) => w[k])]),
  );
  return figure(
    id,
    title,
    caption,
    `<svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${id}-t"><title id="${id}-t">${escapeHtml(title)}</title>${axis}${bars}</svg>`,
    legendHtml,
    table,
  );
}

const legend = (suites, allSuites) =>
  `<ul class="legend">${suites
    .map((s) => `<li><span class="swatch c${slotOf(s, allSuites)}"></span>${escapeHtml(s)}</li>`)
    .join('')}</ul>`;

const chartTable = (head, rows) =>
  `<details><summary>Table view</summary>${table(head, rows)}</details>`;

const figure = (id, title, caption, svg, legendHtml, tableHtml) =>
  `<figure class="card chart" id="${id}"><figcaption><h3>${escapeHtml(title)}</h3><p class="muted">${escapeHtml(caption)}</p></figcaption>${legendHtml}${svg}${tableHtml}</figure>`;

const emptyChart = (title) =>
  `<figure class="card chart"><figcaption><h3>${escapeHtml(title)}</h3></figcaption><p class="muted">No data yet.</p></figure>`;

// ---------------------------------------------------------------------------------------------
// Tiles and tables

function table(head, rows, empty = 'None.') {
  if (!rows.length) return `<p class="muted">${escapeHtml(empty)}</p>`;
  return `<div class="table-wrap"><table><thead><tr>${head.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${cell?.html ?? escapeHtml(cell)}</td>`).join('')}</tr>`,
    )
    .join('')}</tbody></table></div>`;
}

const html = (markup) => ({ html: markup });

function trendHtml(t, format) {
  if (!t)
    return `<span class="trend muted" title="Needs more than ${TREND_RUNS} runs of history">trend n/a</span>`;
  const tone = t.better === null ? 'flat' : t.better ? 'better' : 'worse';
  return `<span class="trend ${tone}">${trendArrow(t)} vs ${escapeHtml(format(t.previous))} ${TREND_RUNS} runs ago</span>`;
}

function tile(id, value, sub, status, trendMarkup) {
  const def = METRICS[id];
  return `<article class="card tile">
  <header><span class="metric-id">${id}</span> ${badge(status)}</header>
  <h3>${escapeHtml(def.name)}</h3>
  <p class="value">${escapeHtml(value)}</p>
  <p class="muted">${escapeHtml(sub)}</p>
  ${trendMarkup}
  <p class="owner"><strong>${escapeHtml(def.owner)}</strong> → ${escapeHtml(def.action)}</p>
</article>`;
}

function tiles(d) {
  const p1 = d.M5.rows.find((r) => r.priority === 'P1');
  const count = (v) => (v === null || v === undefined ? 'n/a' : String(v));
  return [
    tile(
      'M1',
      formatPercent(d.M1.value),
      d.M1.suite ? `lowest suite: ${d.M1.suite} (latest run)` : 'no runs',
      d.M1.status,
      trendHtml(d.trends.M1, formatPercent),
    ),
    tile(
      'M2',
      formatPercent(d.M2.value),
      d.M2.suite ? `highest suite: ${d.M2.suite}, last ${WINDOW_RUNS} runs` : 'no runs',
      d.M2.status,
      trendHtml(d.trends.M2, formatPercent),
    ),
    tile(
      'M3',
      d.M3.value === null ? 'n/a' : `${d.M3.value}/${WINDOW_RUNS}`,
      `most flaky test · ${d.M3.repeatOffenders.length} test(s) flaky ≥ 3 of ${WINDOW_RUNS}`,
      d.M3.status,
      trendHtml(d.trends.M3, count),
    ),
    tile(
      'M4',
      d.M4.value === null ? 'n/a' : `${formatPercent(d.M4.value)} regression`,
      d.M4.week ? `${d.M4.week.week}: mostly ${d.M4.dominant}` : 'no triaged failures yet',
      d.M4.status,
      d.trends.M4
        ? `<span class="trend ${d.trends.M4.better === null ? 'flat' : d.trends.M4.better ? 'better' : 'worse'}">${trendArrow(d.trends.M4)} vs ${formatPercent(d.trends.M4.previous)} the week before</span>`
        : '<span class="trend muted">trend n/a</span>',
    ),
    tile(
      'M5',
      formatPercent(d.M5.value),
      p1 ? `${p1.automated} of ${p1.total} P1 cases automated` : 'no catalogue',
      d.M5.status,
      trendHtml(d.trends.M5, formatPercent),
    ),
    tile(
      'M6',
      d.M6.value === null ? 'n/a' : `${d.M6.value >= 0 ? '+' : ''}${Math.round(d.M6.value * 100)}%`,
      d.M6.suite
        ? `worst suite: ${d.M6.suite}, p95 vs previous ${WINDOW_RUNS} runs`
        : `needs ${2 * MIN_DURATION_RUNS}+ runs per suite`,
      d.M6.status,
      trendHtml(d.trends.M6, (v) => `${Math.round(v * 100)}%`),
    ),
    tile(
      'M7',
      String(d.M7.value),
      d.M7.oldestDays !== null ? `oldest open ${d.M7.oldestDays} days` : 'no open known bugs',
      d.M7.status,
      trendHtml(d.trends.M7, count),
    ),
  ].join('\n');
}

const caseLink = (id, links) =>
  id && links.caseUrl(id)
    ? html(`<a href="${escapeHtml(links.caseUrl(id))}">${escapeHtml(id)}</a>`)
    : (id ?? '—');

const testName = (testId) => {
  const [file, title, project] = testId.split('::');
  return html(
    `${escapeHtml(title ?? testId)}<br><span class="muted small">${escapeHtml(file)} · ${escapeHtml(project ?? '')}</span>`,
  );
};

// ---------------------------------------------------------------------------------------------
// Page

const STYLES = `
:root{color-scheme:light;--page:#f9f9f7;--surface:#fcfcfb;--ink:#0b0b0b;--ink-2:#52514e;--muted:#6f6e69;--grid:#e1e0d9;--axis:#c3c2b7;--border:rgba(11,11,11,.10);
--c1:#2a78d6;--c2:#eb6834;--c3:#1baf7a;--c4:#eda100;--c5:#e87ba4;--c6:#008300;--c7:#6250d6;--c8:#e34948;
--good:#0ca30c;--warning:#fab219;--critical:#d03b3b;--better:#006300;--worse:#b42828;--untriaged:#a9a8a1}
@media (prefers-color-scheme:dark){:root{color-scheme:dark;--page:#0d0d0d;--surface:#1a1a19;--ink:#f0efec;--ink-2:#c3c2b7;--muted:#9a998f;--grid:#2c2c2a;--axis:#383835;--border:rgba(255,255,255,.10);
--c1:#3987e5;--c2:#d95926;--c3:#199e70;--c4:#c98500;--c5:#d55181;--c6:#008300;--c7:#9085e9;--c8:#e66767;--better:#0ca30c;--worse:#e66767;--untriaged:#5c5b56}}
*{box-sizing:border-box}
body{margin:0;background:var(--page);color:var(--ink);font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1200px;margin:0 auto;padding:24px 16px 48px}
h1{font-size:24px;margin:0 0 4px}h2{font-size:18px;margin:32px 0 12px}h3{font-size:15px;margin:0}
a{color:var(--c1)}
.muted{color:var(--muted)}.small{font-size:12px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px}
.sample{background:var(--warning);color:#0b0b0b;border-radius:8px;padding:8px 12px;font-weight:600;margin-bottom:16px}
.health{display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-top:16px}
.health p{margin:0;font-size:16px;flex:1;min-width:240px}
.badge{display:inline-flex;align-items:center;gap:4px;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:600;color:#fff;white-space:nowrap}
.badge.big{font-size:16px;padding:6px 14px}
.s-green{background:var(--good)}.s-amber{background:var(--warning);color:#0b0b0b}.s-red{background:var(--critical)}.s-na{background:var(--untriaged);color:var(--ink)}
.tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}
.tile header{display:flex;justify-content:space-between;align-items:center}
.metric-id{font-size:12px;font-weight:600;color:var(--muted)}
.tile h3{margin-top:6px}.tile p{margin:4px 0}
.value{font-size:28px;font-weight:600}
.trend{font-size:12px;display:block}.trend.better{color:var(--better)}.trend.worse{color:var(--worse)}.trend.flat{color:var(--ink-2)}
.owner{border-top:1px solid var(--border);padding-top:8px;margin-top:8px!important;font-size:13px;color:var(--ink-2)}
.insights{list-style:none;padding:0;margin:0;display:grid;gap:8px}
.insights li{display:flex;gap:12px;align-items:flex-start}
.insights .who{color:var(--ink-2);font-size:13px}
.charts{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,520px),1fr));gap:12px}
.chart{margin:0}.chart svg{width:100%;height:auto;display:block}
.chart figcaption p{margin:2px 0 8px;font-size:13px}
.grid{stroke:var(--grid);stroke-width:1}.axis{stroke:var(--axis);stroke-width:1}
.ref{stroke:var(--muted);stroke-width:1;stroke-dasharray:4 4}.ref-label{fill:var(--muted);font-size:11px}
.tick{fill:var(--muted);font-size:11px;font-variant-numeric:tabular-nums}
.end-label{fill:var(--ink-2);font-size:11px}
.line{fill:none;stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
.dot{stroke:var(--surface);stroke-width:2}
.hit{fill:transparent;stroke:none}.hit:hover{fill:var(--ink);fill-opacity:.15}
.seg{stroke:var(--surface);stroke-width:2}
${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `.line.c${n}{stroke:var(--c${n})}.dot.c${n},.seg.c${n},.swatch.c${n}{fill:var(--c${n});background:var(--c${n})}`).join('')}
.seg.untriaged,.swatch.untriaged{fill:var(--untriaged);background:var(--untriaged)}
.legend{list-style:none;display:flex;flex-wrap:wrap;gap:4px 14px;padding:0;margin:0 0 8px;font-size:12px;color:var(--ink-2)}
.swatch{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px}
details{margin-top:8px;font-size:13px}summary{cursor:pointer;color:var(--ink-2)}
.tables{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,520px),1fr));gap:12px}
.table-wrap{overflow-x:auto}
table{border-collapse:collapse;width:100%;font-size:13px}
th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--grid);vertical-align:top}
th{color:var(--ink-2);font-weight:600}
td{font-variant-numeric:tabular-nums}
footer{margin-top:32px;font-size:12px;color:var(--muted)}
`;

/**
 * @param {ReturnType<import('./model.js').computeDashboard>} d
 * @param {{ caseUrl: (id: string) => string | undefined, generatedAt: string }} links
 */
export function renderDashboardHtml(d, links) {
  const allSuites = [...new Set([...d.charts.passRate, ...d.charts.duration].map((s) => s.suite))];
  const insights = d.insights
    .map(
      (i) =>
        `<li class="card">${badge(i.severity)}<div><div>${escapeHtml(i.text)}</div><div class="who"><strong>${escapeHtml(i.owner)}</strong> → ${escapeHtml(i.action)}</div></div></li>`,
    )
    .join('');

  const suiteRows = d.suites.map((suite) => {
    const m1 = d.M1.rows.find((r) => r.suite === suite);
    const m2 = d.M2.rows.find((r) => r.suite === suite);
    const m6 = d.M6.rows.find((r) => r.suite === suite);
    return [
      suite,
      html(`${escapeHtml(formatPercent(m1.value))} ${badge(m1.status)}`),
      html(`${escapeHtml(formatPercent(m2.value))} ${badge(m2.status)}`),
      `${formatDuration(m6.p95)} (${m6.scope})`,
      html(
        `${m6.increase === null ? 'n/a' : `${m6.increase >= 0 ? '+' : ''}${Math.round(m6.increase * 100)}%`} ${badge(m6.status)}`,
      ),
    ];
  });

  const charts = [
    lineChart({
      id: 'chart-pass',
      title: 'Pass rate per run',
      caption: `M1 · last ${CHART_RUNS} runs per suite · dashed lines: green ≥ 98%, red < 95%`,
      series: d.charts.passRate,
      format: formatPercent,
      yMin: Math.min(
        0.9,
        ...d.charts.passRate.flatMap((s) => s.points.map((p) => Math.floor(p.value * 20) / 20)),
      ),
      yMax: 1,
      refs: [
        { value: THRESHOLDS.passRate.green, label: '98%' },
        { value: THRESHOLDS.passRate.amber, label: '95%' },
      ],
      allSuites,
    }),
    lineChart({
      id: 'chart-flaky',
      title: 'Flaky rate per run',
      caption: `M2 · share of executed tests that passed only on retry · dashed lines: 2% and 5%`,
      series: d.charts.flakyRate,
      format: formatPercent,
      yMin: 0,
      yMax: Math.max(0.08, ...d.charts.flakyRate.flatMap((s) => s.points.map((p) => p.value))),
      refs: [
        { value: THRESHOLDS.flakyRate.green, label: '2%' },
        { value: THRESHOLDS.flakyRate.amber, label: '5%' },
      ],
      allSuites,
    }),
    stackedBars({
      id: 'chart-causes',
      title: 'Failure cause mix per week',
      caption:
        'M4 · AI triage classification of failed tests; untriaged = failures without a triage record',
      weeks: d.charts.causeMix,
    }),
    lineChart({
      id: 'chart-duration',
      title: 'Suite duration p95',
      caption: `M6 · rolling p95 of run wall-clock over ${WINDOW_RUNS} runs, same test selection as the latest run`,
      series: d.charts.duration,
      format: formatDuration,
      yMin: 0,
      yMax:
        Math.max(60_000, ...d.charts.duration.flatMap((s) => s.points.map((p) => p.value))) * 1.1,
      allSuites,
    }),
  ].join('\n');

  const coverageRows = d.M5.rows.map((r) => [
    r.priority,
    `${r.automated} / ${r.total}`,
    r.manual,
    r.planned,
    r.notAutomatable,
    r.priority === 'P1'
      ? html(`${escapeHtml(formatPercent(r.value))} ${badge(d.M5.status)}`)
      : formatPercent(r.value),
  ]);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Quality Dashboard</title>
<style>${STYLES}</style>
</head>
<body>
<main>
${d.sample ? '<div class="sample">⚠️ SAMPLE DATA — generated for illustration, not real test runs.</div>' : ''}
<header>
  <h1>Quality dashboard</h1>
  <p class="muted">Generated ${escapeHtml(links.generatedAt)} · ${d.runs} runs · suites: ${escapeHtml(d.suites.join(', ') || 'none')} · as of ${escapeHtml(dateLabel(d.now))}</p>
  <section class="card health" aria-label="Overall health">
    <span class="badge big s-${d.health.status.replace('/', '')}"><span aria-hidden="true">${STATUS_ICON[d.health.status]}</span> ${STATUS_LABEL[d.health.status]}</span>
    <p>${escapeHtml(d.health.sentence)}</p>
  </section>
</header>

<h2>📊 Metrics</h2>
<section class="tiles">
${tiles(d)}
</section>

<h2>💡 Insights</h2>
<ul class="insights">${insights}</ul>

<h2>📈 Trends</h2>
<section class="charts">
${charts}
</section>

<h2>📋 Details</h2>
<section class="tables">
  <div class="card"><h3>Per suite (M1 · M2 · M6)</h3>${table(['Suite', 'Pass rate (latest)', `Flaky rate (${WINDOW_RUNS} runs)`, 'Duration p95', 'vs baseline'], suiteRows, 'No runs collected yet.')}</div>
  <div class="card"><h3>Top flaky tests (M3, last ${WINDOW_RUNS} runs)</h3>${table(
    ['Test', 'Case', 'Flaky runs', 'Last flaky'],
    d.M3.tests
      .slice(0, 10)
      .map((t) => [
        testName(t.id),
        caseLink(t.tc, links),
        html(
          `${t.flaky} / ${t.runs}${t.flaky > THRESHOLDS.flakyRuns.amber ? ` ${badge(STATUS.RED)}` : ''}`,
        ),
        dateLabel(t.lastFlakyAt),
      ]),
    'No flaky tests in the window. 🎉',
  )}</div>
  <div class="card"><h3>Automation coverage by priority (M5)</h3>${table(['Priority', 'Automated', 'Manual', 'Planned', 'Not automatable', 'Coverage'], coverageRows, 'No catalogue cases.')}</div>
  <div class="card"><h3>Top manual P1 cases (automate next)</h3>${table(
    ['Case', 'Title', 'Status'],
    d.M5.manualP1.slice(0, 10).map((c) => [caseLink(c.id, links), c.title, c.automation]),
    'Every P1 case is automated or not automatable.',
  )}</div>
  <div class="card"><h3>Open known app bugs (M7)</h3>${table(
    ['Issue', 'Test', 'Open since', 'Age'],
    d.M7.bugs.map((b) => [
      html(`<a href="${escapeHtml(b.issue)}">${escapeHtml(b.label)}</a>`),
      b.test.includes('::') ? testName(b.test) : b.test,
      b.addedAt ?? 'n/a',
      html(`${b.ageDays ?? 'n/a'} days${b.ageDays > 30 ? ` ${badge(STATUS.RED)}` : ''}`),
    ]),
    'No open known app bugs.',
  )}</div>
  <div class="card"><h3>Quarantined tests (@quarantine)</h3>${table(
    ['Test', 'Case', 'Quarantined since', 'Age', 'Green streak'],
    d.quarantine.map((q) => [
      testName(q.id),
      caseLink(q.tc, links),
      dateLabel(q.since),
      `${q.ageDays} days`,
      html(`${q.greenStreak} / 10${q.readyToExit ? ` ${badge(STATUS.GREEN)} remove tag` : ''}`),
    ]),
    'No quarantined tests.',
  )}</div>
</section>

<footer>Thresholds, owners and actions: docs/quality-metrics.md · trends compare with the value ${TREND_RUNS} runs ago per suite · this page makes no network requests.</footer>
</main>
</body>
</html>
`;
}
