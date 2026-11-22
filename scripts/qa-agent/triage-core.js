/**
 * Failure classifier used by the triage agent (triage-agent.js) and the evaluation harness
 * (scripts/eval/triage-eval.js).
 *
 * Every result says which classifier answered (`source: 'gemini' | 'heuristic'`). When Gemini was
 * asked but could not answer, the result also carries `fallbackReason`, so a heuristic answer is
 * never mistaken for an AI one.
 */
import https from 'node:https';
import console from 'node:console';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { URL } from 'node:url';

export const CLASSES = ['DOM_SELECTOR_DRIFT', 'TRANSIENT_RPC', 'REGRESSION_DEFECT'];
export const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest';
export const DEFAULT_TEMPERATURE = 0.1;
/**
 * Per-call timeout for Gemini. Flash thinks before it answers: on the paid tier answers took
 * 6–44 s (p50 ~13 s), so the old 15 s limit cut off 43% of calls, mostly hard cases.
 * Override with GEMINI_TIMEOUT_MS.
 */
export const DEFAULT_GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 60000;

/**
 * Robust JSON POST helper:
 * - Uses native global fetch + AbortSignal.timeout on Node 18/20+ (.nvmrc)
 * - Gracefully falls back to node:https for legacy or un-aliased local runtimes (< v18)
 */
export async function postJson(urlStr, data, timeoutMs = DEFAULT_GEMINI_TIMEOUT_MS) {
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

export function buildTriagePrompt(failure) {
  return `
You are an expert Applied AI QA Engineer diagnosing a Playwright test failure for a Web3/DeFi dApp (Supersmooth).
Analyze the failure context below and output your evaluation in strictly valid JSON format matching this schema:
{
  "classification": "DOM_SELECTOR_DRIFT" | "TRANSIENT_RPC" | "REGRESSION_DEFECT",
  "confidenceScore": number (0 to 100),
  "rootCause": "Clear, concise 2-3 sentence explanation of why the test failed.",
  "recommendedAction": "Actionable next step for the QA/Dev engineer.",
  "selfHealingPatch": "Unified git diff or code snippet fix if applicable, otherwise null",
  "targetFile": "Path to file to patch if selfHealingPatch is applicable, otherwise null",
  "replacement": {
    "target": "Exact string or line in targetFile to be replaced",
    "replacement": "Exact replacement string or updated line"
  } | null
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
}

/** Short machine-readable reason for a failed Gemini call, e.g. `http_429`, `timeout`. */
export function fallbackReasonFor(err) {
  const name = err?.name || '';
  const message = String(err?.message || '').toLowerCase();
  if (name === 'TimeoutError' || name === 'AbortError' || message.includes('timed out')) {
    return 'timeout';
  }
  if (err instanceof SyntaxError) return 'parse_error';
  return 'network_error';
}

/**
 * Asks Gemini to classify a failure. Never throws: on any problem it returns the heuristic
 * result with `source: 'heuristic'` and a `fallbackReason`.
 *
 * @param {object} failure - extractFailureContext() item
 * @param {{ apiKey?: string, model?: string, temperature?: number, post?: typeof postJson }} [options]
 *   `post` can be replaced in tests.
 */
export async function callGeminiTriage(failure, options = {}) {
  const {
    apiKey,
    model = DEFAULT_GEMINI_MODEL,
    temperature = DEFAULT_TEMPERATURE,
    post = postJson,
  } = options;
  const fallback = (fallbackReason) => ({
    ...heuristicFallbackClassifier(failure),
    source: 'heuristic',
    fallbackReason,
  });

  if (!apiKey) return fallback('no_api_key');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    const res = await post(url, {
      contents: [{ parts: [{ text: buildTriagePrompt(failure) }] }],
      generationConfig: {
        temperature,
        responseMimeType: 'application/json',
      },
    });

    if (res.status !== 200) {
      console.warn(`[qa-agent] Gemini API call returned ${res.status}: ${res.body}`);
      return fallback(`http_${res.status}`);
    }

    const jsonResponse = JSON.parse(res.body);
    const candidateText = jsonResponse.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) return fallback('empty_response');

    const analysis = JSON.parse(candidateText);
    if (!CLASSES.includes(analysis?.classification)) return fallback('invalid_classification');

    return { ...analysis, source: 'gemini', model };
  } catch (err) {
    const fallbackReason = fallbackReasonFor(err);
    console.warn(
      `[qa-agent] Error during Gemini API call (${fallbackReason}): ${err.message}. Using heuristic classifier.`,
    );
    return fallback(fallbackReason);
  }
}

/**
 * Classifies a failure.
 * - `heuristic`: keyword rules only (free, deterministic).
 * - `gemini`: Gemini, falling back to the heuristic (marked) when the call fails.
 * - `auto` (default): `gemini` when an API key is available, otherwise `heuristic`.
 *
 * @param {object} failure
 * @param {{ provider?: 'auto' | 'gemini' | 'heuristic', apiKey?: string, model?: string,
 *   temperature?: number, post?: typeof postJson }} [options]
 */
export async function classifyFailure(failure, options = {}) {
  const { provider = 'auto', ...geminiOptions } = options;
  if (provider === 'heuristic' || (provider === 'auto' && !geminiOptions.apiKey)) {
    return { ...heuristicFallbackClassifier(failure), source: 'heuristic' };
  }
  return callGeminiTriage(failure, geminiOptions);
}

/**
 * Intelligent heuristic fallback classifier when Gemini API is unavailable or offline.
 */
export function heuristicFallbackClassifier(failure) {
  const err = (failure.errorSnippet + ' ' + failure.stackTrace).toLowerCase();

  // Pattern 1: RPC / Network / Timeout Flakes
  if (
    err.includes('econnrefused') ||
    err.includes('etimedout') ||
    err.includes('enotfound') ||
    err.includes('net::err_') ||
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
      targetFile: null,
      replacement: null,
    };
  }

  // Pattern 2: DOM / Selector Drift
  if (
    err.includes('waiting for') ||
    err.includes('locator.') ||
    err.includes('getbyrole') ||
    err.includes('getbytext') ||
    err.includes('getbytestid') ||
    err.includes('strict mode violation') ||
    err.includes('not visible') ||
    err.includes('element is not attached to the dom') ||
    err.includes('target page, context or browser has been closed')
  ) {
    const locatorMatch =
      failure.errorSnippet.match(/waiting for\s+([^\n]+)/i) ||
      failure.errorSnippet.match(/Locator:\s*([^\n]+)/i) ||
      failure.errorSnippet.match(/getByRole\([^)]+\)/i) ||
      failure.errorSnippet.match(/locator\([^)]+\)/i);
    const targetLocator = locatorMatch ? locatorMatch[1].trim() : 'target locator';

    let selfHealingPatch = null;
    let replacement = null;

    // Check if gitDiff contains modified selector lines for this file
    if (failure.gitDiff) {
      const diffLines = failure.gitDiff.split('\n');
      const removedLines = diffLines
        .filter((l) => l.startsWith('-') && !l.startsWith('---'))
        .map((l) => l.slice(1).trim());
      const addedLines = diffLines
        .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
        .map((l) => l.slice(1).trim());

      if (removedLines.length > 0 && addedLines.length > 0) {
        const addedIdx = addedLines.findIndex((line) =>
          targetLocator && targetLocator !== 'target locator' ? line.includes(targetLocator) : true,
        );
        const resolvedAddedIdx = addedIdx !== -1 ? addedIdx : 0;
        const resolvedRemovedIdx = resolvedAddedIdx < removedLines.length ? resolvedAddedIdx : 0;

        const newCode = addedLines[resolvedAddedIdx];
        const oldCode = removedLines[resolvedRemovedIdx];
        selfHealingPatch = `--- a/${failure.filePath}\n+++ b/${failure.filePath}\n@@ -${failure.line},1 +${failure.line},1 @@\n- ${newCode}\n+ ${oldCode}`;
        replacement = {
          target: newCode,
          replacement: oldCode,
        };
      }
    }

    // Secondary Heuristic: Detect intentional test/drift suffix like '_X' in locator
    if (!replacement && targetLocator && targetLocator.includes('_X')) {
      const cleanLocator = targetLocator.replace(/_X/g, '');
      replacement = {
        target: targetLocator,
        replacement: cleanLocator,
      };
      selfHealingPatch = `--- a/${failure.filePath}\n+++ b/${failure.filePath}\n@@ -${failure.line},1 +${failure.line},1 @@\n- ${targetLocator}\n+ ${cleanLocator}`;
    }

    if (!selfHealingPatch) {
      selfHealingPatch = `// Update locator in ${failure.filePath}:${failure.line}\n// Verify element visibility or adjust selector`;
    }

    return {
      classification: 'DOM_SELECTOR_DRIFT',
      confidenceScore: 92,
      rootCause: `Locator '${targetLocator}' timed out or was not found in the DOM. The frontend UI markup or component selector was modified.`,
      recommendedAction:
        'Inspect the DOM snapshot in the Playwright trace and update the locator in the page object or spec.',
      selfHealingPatch,
      targetFile: failure.filePath || null,
      replacement,
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
    targetFile: null,
    replacement: null,
  };
}

/** Failure context as stored in triage JSON reports and eval datasets (no local file paths). */
export function storableFailureContext(failure) {
  const { attachments, gitDiff, ...rest } = failure;
  return {
    ...rest,
    attachments: (attachments || []).map(({ name, contentType }) => ({ name, contentType })),
    gitDiff: (gitDiff || '').slice(0, 2000),
  };
}
