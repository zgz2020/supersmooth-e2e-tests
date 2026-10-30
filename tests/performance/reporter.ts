export interface CheckItem {
  name: string;
  passes: number;
  fails: number;
  total: number;
  passRate: number;
  passed: boolean;
}

export interface MetricValues {
  avg?: number;
  min?: number;
  med?: number;
  max?: number;
  'p(90)'?: number;
  'p(95)'?: number;
  'p(99)'?: number;
  count?: number;
  rate?: number;
  value?: number;
  passes?: number;
  fails?: number;
}

export interface ThresholdResult {
  ok?: boolean;
}

export interface MetricData {
  type?: string;
  contains?: string;
  values?: MetricValues;
  thresholds?: Record<string, ThresholdResult | boolean>;
}

export interface PerformanceSummary {
  root_group?: {
    name?: string;
    checks?: Record<string, { name: string; passes: number; fails: number }>;
    groups?: Record<string, unknown>;
  };
  metrics?: Record<string, MetricData>;
}

export interface RunHistoryItem {
  id: string;
  timestamp: string;
  dateFormatted: string;
  profile: string;
  target: string;
  totalRequests: number;
  requestsRate: number;
  p95Latency: string;
  checksPassRate: string;
  failedRate: string;
  allChecksPassed: boolean;
  reportFile: string;
}

export function extractChecks(summary: PerformanceSummary): CheckItem[] {
  const items: CheckItem[] = [];

  function walk(group?: {
    name?: string;
    checks?: Record<string, { name: string; passes: number; fails: number }>;
    groups?: Record<string, unknown>;
  }): void {
    if (!group) return;

    if (group.checks) {
      const checksList = Array.isArray(group.checks) ? group.checks : Object.values(group.checks);
      for (const c of checksList) {
        const passes = c.passes || 0;
        const fails = c.fails || 0;
        const total = passes + fails;
        const passRate = total > 0 ? (passes / total) * 100 : 0;
        items.push({
          name: c.name,
          passes,
          fails,
          total,
          passRate,
          passed: fails === 0 && passes > 0,
        });
      }
    }

    if (group.groups) {
      const groupsList = Array.isArray(group.groups) ? group.groups : Object.values(group.groups);
      for (const sub of groupsList) {
        walk(
          sub as {
            name?: string;
            checks?: Record<string, { name: string; passes: number; fails: number }>;
            groups?: Record<string, unknown>;
          },
        );
      }
    }
  }

  walk(summary.root_group);
  return items;
}

export function getMetricValues(metric?: MetricData): MetricValues {
  return metric?.values || {};
}

export function formatDuration(ms?: number): string {
  if (ms === undefined || ms === null || isNaN(ms) || ms === 0) return '0 ms';
  if (ms > 0 && ms < 1) return `${(ms * 1000).toFixed(0)} µs`;
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  return `${ms.toFixed(1)} ms`;
}

export interface TextSummaryMeta {
  profile?: string;
  target?: string;
  targetUrl?: string;
}

export interface HtmlReportOptions {
  targetUrl?: string;
  profile?: string;
  target?: string;
  history?: RunHistoryItem[];
  isArchive?: boolean;
}

export function generateTextSummary(data: PerformanceSummary, meta?: TextSummaryMeta): string {
  const checks = extractChecks(data);
  const metrics = data.metrics || {};
  const duration = getMetricValues(metrics.http_req_duration);
  const reqs = getMetricValues(metrics.http_reqs);
  const failed = getMetricValues(metrics.http_req_failed);

  const totalChecks = checks.length;
  const passedChecks = checks.filter((c) => c.passed).length;
  const failedChecks = totalChecks - passedChecks;
  const passRate = totalChecks > 0 ? ((passedChecks / totalChecks) * 100).toFixed(1) : '100.0';
  const failRate = ((failed.rate ?? 0) * 100).toFixed(2);

  let out = '\n' + '='.repeat(70) + '\n';
  out += '                 PERFORMANCE TEST EXECUTION SUMMARY\n';
  out += '='.repeat(70) + '\n\n';

  if (meta && (meta.profile || meta.target || meta.targetUrl)) {
    out += '--- EXECUTION CONTEXT ---\n';
    if (meta.profile) out += `  Profile             : ${meta.profile.toUpperCase()}\n`;
    if (meta.target) out += `  Target              : ${meta.target}\n`;
    if (meta.targetUrl) out += `  Target Base URL     : ${meta.targetUrl}\n`;
    out += '\n';
  }

  out += '--- ITEMISED CHECKS & VALIDATIONS ---\n';
  if (checks.length === 0) {
    out += '  (no checks executed)\n';
  } else {
    for (const c of checks) {
      const icon = c.passed ? '✓' : '✗';
      const status = c.passed ? 'PASS' : 'FAIL';
      const stats = `${c.passes}/${c.total} passed (${c.passRate.toFixed(0)}%)`;
      out += `  ${icon} [${status}] ${c.name.padEnd(45)} ${stats}\n`;
    }
  }

  out += '\n--- KEY METRICS & SLAS ---\n';
  out += `  Total Requests      : ${reqs.count || 0} (${(reqs.rate || 0).toFixed(2)}/s)\n`;
  out += `  Failed Requests     : ${failRate}%\n`;
  out += `  Checks Passed       : ${passedChecks}/${totalChecks} (${failedChecks} failed, ${passRate}%)\n`;
  out += `  Duration (avg / med): ${formatDuration(duration.avg)} / ${formatDuration(duration.med)}\n`;
  out += `  Duration (p90 / p95): ${formatDuration(duration['p(90)'])} / ${formatDuration(duration['p(95)'])} (p99: ${formatDuration(duration['p(99)'])})\n`;

  out += '\n--- REPORTS GENERATED ---\n';
  out += '  • Itemised Checks Report : performance-reports/report.html\n';
  out += '  • Grafana Web Dashboard  : performance-reports/dashboard.html\n';
  out += '  • Raw Metrics Summary    : performance-reports/summary.json\n';
  out += '='.repeat(70) + '\n';

  return out;
}

export function generateHtmlReport(
  data: PerformanceSummary,
  optionsOrTargetUrl?: string | HtmlReportOptions,
  historyParam?: RunHistoryItem[],
  isArchiveParam = false,
): string {
  const options: HtmlReportOptions =
    typeof optionsOrTargetUrl === 'object' && optionsOrTargetUrl !== null
      ? optionsOrTargetUrl
      : {
          targetUrl: optionsOrTargetUrl,
          history: historyParam,
          isArchive: isArchiveParam,
        };

  const targetUrl = options.targetUrl;
  const profile = options.profile || 'smoke';
  const profileUpper = profile.toUpperCase();
  const targetName = options.target || 'all';
  const history = options.history;
  const isArchive = Boolean(options.isArchive);

  const checks = extractChecks(data);
  const metrics = data.metrics || {};
  const duration = getMetricValues(metrics.http_req_duration);
  const reqs = getMetricValues(metrics.http_reqs);
  const failed = getMetricValues(metrics.http_req_failed);

  const totalChecks = checks.length;
  const passedChecks = checks.filter((c) => c.passed).length;
  const allChecksPassed = totalChecks > 0 && passedChecks === totalChecks;
  const checksPassRate =
    totalChecks > 0 ? ((passedChecks / totalChecks) * 100).toFixed(1) : '100.0';
  const failRate = ((failed.rate ?? 0) * 100).toFixed(2);
  const dateStr = new Date().toISOString();

  // Extract threshold statuses
  const thresholdRows: Array<{ metric: string; rule: string; ok: boolean }> = [];
  for (const [metricName, m] of Object.entries(metrics)) {
    if (m && m.thresholds) {
      for (const [rule, result] of Object.entries(m.thresholds)) {
        const isOk = typeof result === 'boolean' ? result : Boolean(result?.ok);
        thresholdRows.push({
          metric: metricName,
          rule,
          ok: isOk,
        });
      }
    }
  }

  const checkRowsHtml = checks
    .map((c) => {
      const badgeClass = c.passed ? 'badge-pass' : 'badge-fail';
      const badgeText = c.passed ? '✓ PASS' : '✗ FAIL';
      const rateClass = c.passed ? 'text-pass' : 'text-fail';
      return `<tr>
        <td><span class="badge ${badgeClass}">${badgeText}</span></td>
        <td class="check-name">${escapeHtml(c.name)}</td>
        <td class="num">${c.passes}</td>
        <td class="num">${c.fails}</td>
        <td class="num ${rateClass}"><strong>${c.passRate.toFixed(1)}%</strong></td>
      </tr>`;
    })
    .join('\n');

  const thresholdRowsHtml =
    thresholdRows.length === 0
      ? '<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">No thresholds configured</td></tr>'
      : thresholdRows
          .map((t) => {
            const badgeClass = t.ok ? 'badge-pass' : 'badge-fail';
            const badgeText = t.ok ? '✓ PASS' : '✗ BREACHED';
            return `<tr>
              <td><code>${escapeHtml(t.metric)}</code></td>
              <td><code>${escapeHtml(t.rule)}</code></td>
              <td><span class="badge ${badgeClass}">${badgeText}</span></td>
            </tr>`;
          })
          .join('\n');

  const dashboardHref = isArchive ? '../dashboard.html' : 'dashboard.html';
  const summaryHref = isArchive ? '../summary.json' : 'summary.json';

  const historyRowsHtml =
    history && history.length > 0
      ? history
          .map((run, idx) => {
            const isCurrent = idx === 0;
            const rowClass = isCurrent ? 'style="background-color: rgba(56, 139, 253, 0.08);"' : '';
            const rateClass = run.allChecksPassed ? 'text-pass' : 'text-fail';
            const linkHref = isArchive ? `report-${run.id}.html` : `history/report-${run.id}.html`;
            const actionCol = isCurrent
              ? '<span class="badge" style="background: rgba(56, 139, 253, 0.2); color: #58a6ff; border: 1px solid #58a6ff;">Current</span>'
              : `<a href="${linkHref}" target="_blank" rel="noopener noreferrer" class="btn" style="padding: 2px 8px; font-size: 11px;">View ↗</a>`;

            const cleanTarget =
              run.target.length > 30 ? `${run.target.slice(0, 27)}...` : run.target;

            return `<tr ${rowClass}>
              <td><strong>${escapeHtml(run.dateFormatted)}</strong></td>
              <td><code>${escapeHtml(run.profile)}</code></td>
              <td><span title="${escapeHtml(run.target)}">${escapeHtml(cleanTarget)}</span></td>
              <td class="num">${run.totalRequests}</td>
              <td class="num"><strong>${escapeHtml(run.p95Latency)}</strong></td>
              <td class="num ${rateClass}"><strong>${escapeHtml(run.checksPassRate)}</strong></td>
              <td class="num">${escapeHtml(run.failedRate)}</td>
              <td style="text-align: center;">${actionCol}</td>
            </tr>`;
          })
          .join('\n')
      : `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">No previous ${escapeHtml(profile)} runs recorded</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>k6 Performance Test Report - ${escapeHtml(profileUpper)} (${escapeHtml(targetName)})</title>
  <style>
    :root {
      --bg: #0d1117;
      --card-bg: #161b22;
      --border: #30363d;
      --text: #c9d1d9;
      --text-muted: #8b949e;
      --heading: #f0f6fc;
      --green: #238636;
      --green-bg: rgba(46, 160, 67, 0.15);
      --red: #da3633;
      --red-bg: rgba(248, 81, 73, 0.15);
      --accent: #58a6ff;
      --accent-bg: rgba(56, 139, 253, 0.15);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 32px 24px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
      flex-wrap: wrap;
      gap: 16px;
    }
    h1 { font-size: 24px; color: var(--heading); display: flex; align-items: center; gap: 10px; }
    .header-links { display: flex; gap: 12px; }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      text-decoration: none;
      color: var(--heading);
      background-color: var(--card-bg);
      border: 1px solid var(--border);
      transition: all 0.15s ease;
    }
    .btn:hover { border-color: var(--accent); color: var(--accent); }
    .btn-primary { background: var(--accent); color: #fff; border-color: var(--accent); }
    .btn-primary:hover { background: #4797ef; color: #fff; }
    .meta-bar {
      display: flex;
      gap: 20px;
      font-size: 13px;
      color: var(--text-muted);
      margin-bottom: 24px;
      flex-wrap: wrap;
    }
    .meta-bar strong { color: var(--text); }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.3px;
    }
    .badge-pass { background-color: var(--green-bg); color: #3fb950; border: 1px solid var(--green); }
    .badge-fail { background-color: var(--red-bg); color: #f85149; border: 1px solid var(--red); }
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }
    .card {
      background-color: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
    }
    .card-label { font-size: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
    .card-value { font-size: 26px; font-weight: 700; color: var(--heading); margin-top: 6px; }
    .card-sub { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
    .text-pass { color: #3fb950; }
    .text-fail { color: #f85149; }
    section { margin-bottom: 32px; }
    h2 { font-size: 18px; color: var(--heading); margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; }
    table {
      width: 100%;
      border-collapse: collapse;
      background-color: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
      font-size: 13px;
    }
    th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--border); }
    th { background-color: rgba(255, 255, 255, 0.02); font-weight: 600; color: var(--text-muted); }
    tr:last-child td { border-bottom: none; }
    tr:hover { background-color: rgba(255, 255, 255, 0.02); }
    td.num { text-align: right; }
    th.num { text-align: right; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; background: rgba(110, 118, 129, 0.2); padding: 2px 6px; border-radius: 4px; }
    .check-name { font-weight: 500; color: var(--heading); }
    footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid var(--border);
      text-align: center;
      font-size: 12px;
      color: var(--text-muted);
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>
          <span>k6 Performance Test Report</span>
          <span class="badge" style="background: rgba(163, 113, 247, 0.15); color: #bc8cff; border: 1px solid #a371f7; text-transform: uppercase;">
            ${escapeHtml(profileUpper)}
          </span>
          <span class="badge ${allChecksPassed ? 'badge-pass' : 'badge-fail'}">
            ${allChecksPassed ? '✓ ALL CHECKS PASSED' : '✗ CHECKS FAILED'}
          </span>
        </h1>
      </div>
      <div class="header-links">
        <a href="${dashboardHref}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" title="View interactive Grafana time-series charts (opens in a new tab)">📈 Grafana Web Dashboard ↗</a>
        <a href="${summaryHref}" target="_blank" rel="noopener noreferrer" class="btn" title="View raw k6 metric JSON summary (opens in a new tab)">📄 Summary JSON ↗</a>
      </div>
    </header>

    <div class="meta-bar">
      <div>Profile: <strong><code>${escapeHtml(profile)}</code></strong></div>
      <div>Target: <strong><code>${escapeHtml(targetName)}</code></strong></div>
      <div>Executed at: <strong>${dateStr}</strong></div>
      <div>Target Base URL: <strong>${escapeHtml(targetUrl || 'Default Target')}</strong></div>
      <div>Total Checks: <strong>${totalChecks} (${passedChecks} passed, ${totalChecks - passedChecks} failed)</strong></div>
    </div>

    <div class="cards-grid">
      <div class="card">
        <div class="card-label">Checks Pass Rate</div>
        <div class="card-value ${allChecksPassed ? 'text-pass' : 'text-fail'}">${checksPassRate}%</div>
        <div class="card-sub">${passedChecks} / ${totalChecks} validations passed</div>
      </div>
      <div class="card">
        <div class="card-label">Total Requests</div>
        <div class="card-value">${reqs.count || 0}</div>
        <div class="card-sub">${(reqs.rate || 0).toFixed(2)} reqs / sec</div>
      </div>
      <div class="card">
        <div class="card-label">p(95) Duration</div>
        <div class="card-value">${formatDuration(duration['p(95)'])}</div>
        <div class="card-sub">avg: ${formatDuration(duration.avg)} | med: ${formatDuration(duration.med)}</div>
      </div>
      <div class="card">
        <div class="card-label">Failed Requests</div>
        <div class="card-value ${failRate === '0.00' ? 'text-pass' : 'text-fail'}">${failRate}%</div>
        <div class="card-sub">threshold target: &lt; 1.00%</div>
      </div>
    </div>

    <section>
      <h2>
        <span>📋 Itemised Checks & Page Validations</span>
        <span style="font-size: 13px; font-weight: normal; color: var(--text-muted);">${checks.length} checks</span>
      </h2>
      <table>
        <thead>
          <tr>
            <th style="width: 100px;">Status</th>
            <th>Check / Assertion</th>
            <th class="num" style="width: 90px;">Passes</th>
            <th class="num" style="width: 90px;">Fails</th>
            <th class="num" style="width: 120px;">Success Rate</th>
          </tr>
        </thead>
        <tbody>
          ${checkRowsHtml}
        </tbody>
      </table>
    </section>

    <section>
      <h2>SLA Thresholds & Pass/Fail Criteria</h2>
      <table>
        <thead>
          <tr>
            <th>Metric</th>
            <th>Condition Rule</th>
            <th style="width: 140px;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${thresholdRowsHtml}
        </tbody>
      </table>
    </section>

    <section>
      <h2>HTTP Request Timings & Latency Percentiles</h2>
      <table>
        <thead>
          <tr>
            <th>Metric</th>
            <th class="num">Min</th>
            <th class="num">Avg</th>
            <th class="num">Median</th>
            <th class="num">p(90)</th>
            <th class="num">p(95)</th>
            <th class="num">p(99)</th>
            <th class="num">Max</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>http_req_duration</code></td>
            <td class="num">${formatDuration(duration.min)}</td>
            <td class="num">${formatDuration(duration.avg)}</td>
            <td class="num">${formatDuration(duration.med)}</td>
            <td class="num">${formatDuration(duration['p(90)'])}</td>
            <td class="num"><strong>${formatDuration(duration['p(95)'])}</strong></td>
            <td class="num">${formatDuration(duration['p(99)'])}</td>
            <td class="num">${formatDuration(duration.max)}</td>
          </tr>
        </tbody>
      </table>
    </section>

    ${
      history && history.length > 0
        ? `<section>
      <h2>
        <span>📜 Execution History & Comparison (${escapeHtml(profileUpper)} Profile)</span>
        <span style="font-size: 13px; font-weight: normal; color: var(--text-muted);">${history.length} recent ${escapeHtml(profile)} run${history.length === 1 ? '' : 's'}</span>
      </h2>
      <table>
        <thead>
          <tr>
            <th style="width: 170px;">Execution Date</th>
            <th style="width: 90px;">Profile</th>
            <th>Target(s)</th>
            <th class="num" style="width: 80px;">Requests</th>
            <th class="num" style="width: 110px;">p(95) Latency</th>
            <th class="num" style="width: 110px;">Checks Pass %</th>
            <th class="num" style="width: 90px;">Errors %</th>
            <th style="width: 90px; text-align: center;">Report</th>
          </tr>
        </thead>
        <tbody>
          ${historyRowsHtml}
        </tbody>
      </table>
    </section>`
        : ''
    }

    <footer>
      Generated natively by Grafana k6 • sov-e2e-tests
    </footer>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
