import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { pathToFileURL } from 'node:url';
import dotenv from 'dotenv';
import { extractFailureContext } from './extract-failure-context.js';
import { classifyFailure, postJson, storableFailureContext } from './triage-core.js';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const MAX_FAILURES_TO_ANALYZE = 3;

/** Which classifier answered, e.g. `gemini` or `heuristic (fallback: http_429)`. */
export function sourceLabel(analysis) {
  if (analysis.source === 'gemini') return 'gemini';
  return analysis.fallbackReason && analysis.fallbackReason !== 'no_api_key'
    ? `heuristic (fallback: ${analysis.fallbackReason})`
    : 'heuristic';
}

function detectSuiteName(failures) {
  const project = failures.find((f) => f.projectName)?.projectName;
  if (project) {
    return project;
  }
  if (
    process.env.REPORT_FOLDER &&
    process.env.REPORT_FOLDER !== 'local' &&
    process.env.REPORT_FOLDER !== 'default'
  ) {
    return process.env.REPORT_FOLDER;
  }
  const firstPath = failures[0]?.filePath || '';
  if (firstPath.includes('with-wallet')) return 'with-wallet';
  if (firstPath.includes('no-wallet')) return 'no-wallet';
  if (firstPath.includes('api')) return 'api';
  if (firstPath.includes('cross-browser')) return 'cross-browser';
  return 'e2e';
}

function formatTimestamp() {
  const d = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const mins = pad(d.getMinutes());
  const secs = pad(d.getSeconds());
  return `${year}${month}${day}-${hours}${mins}${secs}`;
}

async function sendDiscordNotification(analyses, suiteName = 'e2e') {
  if (!DISCORD_WEBHOOK_URL) {
    console.log('[qa-agent] DISCORD_WEBHOOK_URL not configured. Skipping Discord notification.');
    return;
  }

  const fields = analyses.map((item, idx) => {
    const emoji =
      item.analysis.classification === 'TRANSIENT_RPC'
        ? '⏳'
        : item.analysis.classification === 'DOM_SELECTOR_DRIFT'
          ? '🔍'
          : '🚨';

    return {
      name: `${emoji} Failure #${idx + 1}: ${item.failure.testTitle}`,
      value: [
        `**File:** \`${item.failure.filePath}:${item.failure.line || '?'}\``,
        `**Classification:** \`${item.analysis.classification}\` (Confidence: ${item.analysis.confidenceScore}%)`,
        `**Classifier:** ${sourceLabel(item.analysis)}`,
        `**Root Cause:** ${item.analysis.rootCause}`,
        item.analysis.selfHealingPatch
          ? `**Suggested Fix:**\n\`\`\`ts\n${item.analysis.selfHealingPatch.slice(0, 300)}\n\`\`\``
          : '',
      ]
        .filter(Boolean)
        .join('\n'),
      inline: false,
    };
  });

  const payload = {
    username: 'Antigravity QA Agent',
    avatar_url:
      'https://raw.githubusercontent.com/microsoft/playwright/main/docs/src/assets/playwright-logo.png',
    embeds: [
      {
        title: `🤖 Applied AI Test Triage Report [${suiteName}]`,
        description: `Analyzed **${analyses.length}** test failure(s) in **${suiteName}** execution.`,
        color: analyses.some((a) => a.analysis.classification === 'REGRESSION_DEFECT')
          ? 15158332
          : 15844367,
        fields,
        footer: {
          text: `Sov-E2E-Tests QA Agent • ${new Date().toISOString()}`,
        },
      },
    ],
  };

  try {
    const res = await postJson(DISCORD_WEBHOOK_URL, payload);
    if (res.status >= 200 && res.status < 300) {
      console.log('✅ [qa-agent] Sent triage notification to Discord successfully.');
    } else {
      console.warn(`[qa-agent] Discord webhook responded with HTTP ${res.status}: ${res.body}`);
    }
  } catch (err) {
    console.warn(`[qa-agent] Error sending Discord notification: ${err.message}`);
  }
}

async function run() {
  console.log('🤖 [qa-agent] Starting Applied AI Test Triage...');

  const failures = extractFailureContext();

  if (failures.length === 0) {
    console.log('✅ [qa-agent] No failed tests found in artifacts. All clean!');
    process.exit(0);
  }

  const countToAnalyze = Math.min(failures.length, MAX_FAILURES_TO_ANALYZE);
  console.log(
    `⚠️  [qa-agent] Detected ${failures.length} failed test(s). Triaging top ${countToAnalyze}...`,
  );

  const targetFailures = failures.slice(0, MAX_FAILURES_TO_ANALYZE);
  const analyses = [];

  for (const failure of targetFailures) {
    console.log(`\n🔍 Analyzing: ${failure.testTitle} (${failure.filePath}:${failure.line})`);
    const analysis = await classifyFailure(failure, { apiKey: GEMINI_API_KEY });

    analyses.push({ failure, analysis });

    console.log(
      `🏷️  Classification: [${analysis.classification}] (Confidence: ${analysis.confidenceScore}%) via ${sourceLabel(analysis)}`,
    );
    console.log(`💡 Root Cause: ${analysis.rootCause}`);
    console.log(`🛠️  Action: ${analysis.recommendedAction}`);
    if (analysis.selfHealingPatch) {
      console.log(`🩹 Patch:\n${analysis.selfHealingPatch}`);
    }
  }

  // Save report locally to ai-reports/
  const reportsDir = path.resolve(process.cwd(), 'ai-reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const suiteName = detectSuiteName(failures);
  const timestamp = formatTimestamp();
  const reportPath = path.join(reportsDir, `triage-${suiteName}-${timestamp}.md`);
  const suiteCommentPath = path.join(reportsDir, `latest-github-comment-${suiteName}.md`);
  const latestCommentPath = path.join(reportsDir, 'latest-github-comment.md');

  const githubMarkdownContent = [
    `## 🤖 Applied AI Test Failure Triage Report [${suiteName}]`,
    `> [!WARNING]`,
    `> **Suite / Run:** \`${suiteName}\` • **Automated Diagnosis:** ${analyses.length} failed test(s) triaged. Review the root-cause analysis and proposed self-healing fixes below.`,
    ``,
    `| # | Test Title | Classification | Confidence | Classifier | Recommended Action |`,
    `| :-: | :--- | :---: | :---: | :---: | :--- |`,
    ...analyses.map(({ failure, analysis }, i) => {
      const emoji =
        analysis.classification === 'TRANSIENT_RPC'
          ? '⏳ `TRANSIENT_RPC`'
          : analysis.classification === 'DOM_SELECTOR_DRIFT'
            ? '🔍 `DOM_DRIFT`'
            : '🚨 `REGRESSION`';
      return `| ${i + 1} | \`${failure.filePath}:${failure.line || '?'}\` | ${emoji} | **${analysis.confidenceScore}%** | ${sourceLabel(analysis)} | ${analysis.recommendedAction.slice(0, 80)}... |`;
    }),
    ``,
    `---`,
    ...analyses.map(
      ({ failure, analysis }, i) => `
### ❌ Failure #${i + 1}: ${failure.testTitle}
- **Spec File:** \`${failure.filePath}:${failure.line || '?'}\`
- **Classification:** **\`${analysis.classification}\`** (Confidence: **${analysis.confidenceScore}%**)
- **🤖 Classifier:** ${sourceLabel(analysis)}
- **💡 Root Cause:** ${analysis.rootCause}
- **🛠️ Action Required:** ${analysis.recommendedAction}

${
  analysis.selfHealingPatch
    ? `#### 🩹 Proposed Fix / Patch:
\`\`\`diff
${analysis.selfHealingPatch}
\`\`\``
    : ''
}

<details>
<summary><b>🔍 Code Context & Stack Trace</b></summary>

**Failing Line Context:**
\`\`\`typescript
${failure.sourceCodeSnippet || 'Source not available'}
\`\`\`

**Playwright Error Output:**
\`\`\`text
${failure.errorSnippet}
${failure.stackTrace}
\`\`\`
</details>
`,
    ),
    `> *Generated by Antigravity Applied AI QA Agent • UTC ${new Date().toUTCString()}*`,
  ].join('\n');

  fs.writeFileSync(reportPath, githubMarkdownContent, 'utf-8');
  fs.writeFileSync(suiteCommentPath, githubMarkdownContent, 'utf-8');
  fs.writeFileSync(latestCommentPath, githubMarkdownContent, 'utf-8');

  // Save machine-readable structured JSON report for self-healing agent and automation
  const structuredData = {
    suiteName,
    timestamp,
    generatedAt: new Date().toISOString(),
    failuresCount: failures.length,
    triagedCount: analyses.length,
    analyses: analyses.map(({ failure, analysis }) => ({
      testTitle: failure.testTitle,
      specFile: failure.specFile || failure.filePath,
      filePath: failure.filePath,
      line: failure.line,
      column: failure.column,
      status: failure.status,
      durationMs: failure.durationMs,
      retries: failure.retries || 0,
      classification: analysis.classification,
      confidenceScore: analysis.confidenceScore,
      rootCause: analysis.rootCause,
      recommendedAction: analysis.recommendedAction,
      selfHealingPatch: analysis.selfHealingPatch || null,
      targetFile: analysis.targetFile || failure.filePath || null,
      replacement: analysis.replacement || null,
      source: analysis.source,
      fallbackReason: analysis.fallbackReason || null,
      failureContext: storableFailureContext(failure),
    })),
  };

  const jsonReportPath = path.join(reportsDir, `triage-${suiteName}-${timestamp}.json`);
  const latestJsonPath = path.join(reportsDir, 'latest-triage-data.json');
  fs.writeFileSync(jsonReportPath, JSON.stringify(structuredData, null, 2), 'utf-8');
  fs.writeFileSync(latestJsonPath, JSON.stringify(structuredData, null, 2), 'utf-8');

  console.log(`\n📄 [qa-agent] Full report saved to: ${reportPath}`);
  console.log(`📊 [qa-agent] Structured JSON data saved to: ${latestJsonPath}`);
  console.log(`📋 [qa-agent] Ready-to-paste GitHub markup saved to: ${suiteCommentPath}`);

  // If running inside GitHub Actions, publish directly to Step Summary
  if (process.env.GITHUB_STEP_SUMMARY) {
    try {
      fs.appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        '\n' + githubMarkdownContent + '\n',
        'utf-8',
      );
      console.log('🚀 [qa-agent] Published diagnosis to GitHub Actions Step Summary!');
    } catch (err) {
      console.warn(`[qa-agent] Could not write to GITHUB_STEP_SUMMARY: ${err.message}`);
    }
  }

  // Send Discord notification if configured
  await sendDiscordNotification(analyses, suiteName);

  console.log('🏁 [qa-agent] Triage complete.\n');
}

// Run only when executed directly, so the module can be imported (e.g. by tests)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((err) => {
    console.error('[qa-agent] Fatal error in triage agent:', err);
    process.exit(1);
  });
}
