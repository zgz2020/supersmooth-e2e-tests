import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import process from 'node:process';
import console from 'node:console';
import { Buffer } from 'node:buffer';
import { URL } from 'node:url';
import dotenv from 'dotenv';
import { extractFailureContext } from './extract-failure-context.js';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const MAX_FAILURES_TO_ANALYZE = 3;

/**
 * Robust JSON POST helper:
 * - Uses native global fetch + AbortSignal.timeout on Node 18/20+ (.nvmrc)
 * - Gracefully falls back to node:https for legacy or un-aliased local runtimes (< v18)
 */
async function postJson(urlStr, data, timeoutMs = 15000) {
  if (typeof globalThis.fetch === 'function') {
    const res = await globalThis.fetch(urlStr, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: globalThis.AbortSignal?.timeout
        ? globalThis.AbortSignal.timeout(timeoutMs)
        : undefined,
    });
    const body = await res.text();
    return { status: res.status, body };
  }

  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(urlStr);
      const payload = JSON.stringify(data);

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body }));
      });

      req.on('error', (err) => reject(err));
      req.setTimeout(timeoutMs, () => {
        req.destroy(new Error('Request timed out'));
      });

      req.write(payload);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

async function callGeminiTriage(failure) {
  const model = 'gemini-flash-latest';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const prompt = `
You are an expert Applied AI QA Engineer diagnosing a Playwright test failure for a Web3/DeFi dApp (Supersmooth).
Analyze the failure context below and output your evaluation in strictly valid JSON format matching this schema:
{
  "classification": "DOM_SELECTOR_DRIFT" | "TRANSIENT_RPC" | "REGRESSION_DEFECT",
  "confidenceScore": number (0 to 100),
  "rootCause": "Clear, concise 2-3 sentence explanation of why the test failed.",
  "recommendedAction": "Actionable next step for the QA/Dev engineer.",
  "selfHealingPatch": "Unified git diff or code snippet fix if applicable, otherwise null"
}

Failure Context:
- Test: ${failure.testTitle}
- File: ${failure.filePath}:${failure.line}
- Status: ${failure.status} (Duration: ${failure.durationMs || 0}ms)
- Error Message:
${failure.errorSnippet}

Stack Trace:
${failure.stackTrace}

Code Around Failing Line:
${failure.sourceCodeSnippet}

Recent Git Diff:
${failure.gitDiff || 'None'}
`;

  try {
    const res = await postJson(url, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    });

    if (res.status !== 200) {
      console.warn(`[qa-agent] Gemini API call returned ${res.status}: ${res.body}`);
      return heuristicFallbackClassifier(failure);
    }

    const jsonResponse = JSON.parse(res.body);
    const candidateText = jsonResponse.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      return heuristicFallbackClassifier(failure);
    }

    return JSON.parse(candidateText);
  } catch (err) {
    console.warn(
      `[qa-agent] Error during Gemini API call: ${err.message}. Using heuristic classifier.`,
    );
    return heuristicFallbackClassifier(failure);
  }
}

/**
 * Intelligent heuristic fallback classifier when Gemini API is unavailable or offline.
 */
function heuristicFallbackClassifier(failure) {
  const err = (failure.errorSnippet + ' ' + failure.stackTrace).toLowerCase();

  // Pattern 1: RPC / Network / Timeout Flakes
  if (
    err.includes('econnrefused') ||
    err.includes('etimedout') ||
    err.includes('fetch failed') ||
    err.includes('rpc') ||
    err.includes('rate limit') ||
    err.includes('nonce') ||
    err.includes('replacement transaction underpriced') ||
    err.includes('socket hang up')
  ) {
    return {
      classification: 'TRANSIENT_RPC',
      confidenceScore: 88,
      rootCause:
        'Failure was caused by an external RPC timeout or network connectivity interruption during node communication.',
      recommendedAction:
        'Retry only this specific test spec without rerunning the entire matrix. Verify RPC endpoint health.',
      selfHealingPatch: null,
    };
  }

  // Pattern 2: DOM / Selector Drift
  if (
    err.includes('waiting for locator') ||
    err.includes('locator.click: timeout') ||
    err.includes('locator.fill: timeout') ||
    err.includes('strict mode violation') ||
    err.includes('not visible') ||
    err.includes('element is not attached to the dom')
  ) {
    const locatorMatch =
      failure.errorSnippet.match(/Locator:\s*([^\n]+)/i) ||
      failure.errorSnippet.match(/locator\('([^']+)'\)/i) ||
      failure.errorSnippet.match(/getByRole\('([^']+)'/i);
    const targetLocator = locatorMatch ? locatorMatch[1].trim() : 'target locator';

    return {
      classification: 'DOM_SELECTOR_DRIFT',
      confidenceScore: 85,
      rootCause: `Locator '${targetLocator}' timed out or was not found in the DOM. The frontend UI markup likely updated or changed test attributes.`,
      recommendedAction:
        'Inspect the DOM snapshot in the Playwright trace and update the locator in the page object or spec.',
      selfHealingPatch: `// Update locator in ${failure.filePath}:${failure.line}\n// Verify element visibility or adjust selector`,
    };
  }

  // Pattern 3: True Regression Defect
  return {
    classification: 'REGRESSION_DEFECT',
    confidenceScore: 82,
    rootCause:
      'The assertion failed with unexpected data or state mismatch, indicating a potential application code regression or broken API contract.',
    recommendedAction:
      'Investigate recent backend/frontend commits to verify if acceptance criteria or API payloads changed.',
    selfHealingPatch: null,
  };
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
    const analysis = GEMINI_API_KEY
      ? await callGeminiTriage(failure)
      : heuristicFallbackClassifier(failure);

    analyses.push({ failure, analysis });

    console.log(
      `🏷️  Classification: [${analysis.classification}] (Confidence: ${analysis.confidenceScore}%)`,
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
    `| # | Test Title | Classification | Confidence | Recommended Action |`,
    `| :-: | :--- | :---: | :---: | :--- |`,
    ...analyses.map(({ failure, analysis }, i) => {
      const emoji =
        analysis.classification === 'TRANSIENT_RPC'
          ? '⏳ `TRANSIENT_RPC`'
          : analysis.classification === 'DOM_SELECTOR_DRIFT'
            ? '🔍 `DOM_DRIFT`'
            : '🚨 `REGRESSION`';
      return `| ${i + 1} | \`${failure.filePath}:${failure.line || '?'}\` | ${emoji} | **${analysis.confidenceScore}%** | ${analysis.recommendedAction.slice(0, 80)}... |`;
    }),
    ``,
    `---`,
    ...analyses.map(
      ({ failure, analysis }, i) => `
### ❌ Failure #${i + 1}: ${failure.testTitle}
- **Spec File:** \`${failure.filePath}:${failure.line || '?'}\`
- **Classification:** **\`${analysis.classification}\`** (Confidence: **${analysis.confidenceScore}%**)
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
  console.log(`\n📄 [qa-agent] Full report saved to: ${reportPath}`);
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

run().catch((err) => {
  console.error('[qa-agent] Fatal error in triage agent:', err);
  process.exit(1);
});
