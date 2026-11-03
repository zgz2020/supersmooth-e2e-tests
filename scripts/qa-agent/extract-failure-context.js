import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { execSync } from 'node:child_process';

/**
 * Extracts failure context from Playwright test artifacts.
 * Reads test-results/results.json or inspects test-results/ directory.
 * @param {string} resultsJsonPath
 * @returns {Array<object>} List of structured failure contexts
 */
export function extractFailureContext(resultsJsonPath = 'test-results/results.json') {
  const failures = [];

  if (fs.existsSync(resultsJsonPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(resultsJsonPath, 'utf-8'));
      collectFailuresFromSuite(data.suites || [], failures);
    } catch (err) {
      console.warn(`[qa-agent] Could not parse ${resultsJsonPath}: ${err.message}`);
    }
  }

  // Fallback: If no results.json or no failures found in json, inspect test-results directory
  if (failures.length === 0 && fs.existsSync('test-results')) {
    collectFailuresFromArtifactsDir('test-results', failures);
  }

  // Enrich each failure with code snippets and git diff
  return failures.map(enrichFailureWithCodeAndDiff);
}

function stripAnsi(str) {
  if (typeof str !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return str.replace(/\u001b\[[0-9;]*m/g, '');
}

function collectFailuresFromSuite(suites, failures) {
  for (const suite of suites) {
    if (suite.specs) {
      for (const spec of suite.specs) {
        for (const test of spec.tests || []) {
          // Playwright test outcomes: 'expected' (pass/skip), 'unexpected' (failed after retries), 'flaky' (recovered)
          // Triage only unrecovered failures (or fallback to testing final execution attempt)
          const isUnexpected = test.status ? test.status === 'unexpected' : true;
          if (!isUnexpected) {
            continue;
          }

          const results = test.results || [];
          if (results.length === 0) {
            continue;
          }

          // Inspect only the final execution attempt to avoid duplicate triage on retried tests
          const finalResult = results[results.length - 1];
          if (finalResult.status === 'failed' || finalResult.status === 'timedOut') {
            const rawErrors =
              finalResult.errors && finalResult.errors.length > 0
                ? finalResult.errors
                : [finalResult.error].filter(Boolean);

            // Find specific error that contains action/locator failure details
            const specificError =
              rawErrors.find(
                (e) => e.message && !stripAnsi(e.message).startsWith('Test timeout of'),
              ) ||
              rawErrors[0] ||
              {};

            let resolvedSpecFile = spec.file;
            if (resolvedSpecFile && !fs.existsSync(resolvedSpecFile)) {
              const candidate = path.join('tests', resolvedSpecFile);
              if (fs.existsSync(candidate)) {
                resolvedSpecFile = candidate;
              }
            }

            // Resolve actual failing file and line (e.g. Page Object vs Spec)
            let resolvedFilePath = resolvedSpecFile;
            let resolvedLine = spec.line;
            let resolvedColumn = spec.column;

            if (specificError.location?.file) {
              const relPath = path.relative(process.cwd(), specificError.location.file);
              if (fs.existsSync(relPath)) {
                resolvedFilePath = relPath;
                resolvedLine = specificError.location.line;
                resolvedColumn = specificError.location.column;
              }
            }

            // Combine messages and stack traces cleanly without ANSI codes
            const combinedError = rawErrors
              .map((e) => stripAnsi(e.message || ''))
              .filter(Boolean)
              .join('\n\n');

            const combinedStack = rawErrors
              .map((e) => stripAnsi(e.stack || ''))
              .filter(Boolean)
              .join('\n\n');

            failures.push({
              testTitle: spec.title || suite.title,
              projectName: test.projectName || '',
              specFile: resolvedSpecFile,
              specLine: spec.line,
              filePath: resolvedFilePath,
              line: resolvedLine,
              column: resolvedColumn,
              status: finalResult.status,
              durationMs: finalResult.duration,
              retries: finalResult.retry || 0,
              attempts: results.length,
              errorSnippet: (combinedError || 'Unknown error').slice(0, 2500),
              stackTrace: combinedStack.slice(0, 2500),
              attachments: (finalResult.attachments || []).map((att) => ({
                name: att.name,
                contentType: att.contentType,
                path: att.path,
              })),
            });
          }
        }
      }
    }
    if (suite.suites) {
      collectFailuresFromSuite(suite.suites, failures);
    }
  }
}

function collectFailuresFromArtifactsDir(dir, failures) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== '.' && entry.name !== '..') {
        const subDir = path.join(dir, entry.name);
        const files = fs.readdirSync(subDir);
        const errorImg = files.find((f) => f.includes('failure') || f.includes('test-failed'));
        const traceZip = files.find((f) => f.endsWith('.zip'));

        if (errorImg || traceZip) {
          failures.push({
            testTitle: entry.name.replace(/-/g, ' '),
            filePath: entry.name,
            line: null,
            status: 'failed',
            errorSnippet: `Test failure artifacts found in ${subDir}`,
            stackTrace: '',
            attachments: [
              ...(errorImg ? [{ name: 'screenshot', path: path.join(subDir, errorImg) }] : []),
              ...(traceZip ? [{ name: 'trace', path: path.join(subDir, traceZip) }] : []),
            ],
          });
        }
      }
    }
  } catch (err) {
    console.warn(`[qa-agent] Error reading test-results dir: ${err.message}`);
  }
}

function enrichFailureWithCodeAndDiff(failure) {
  let resolvedPath = failure.filePath;
  if (resolvedPath && !fs.existsSync(resolvedPath)) {
    const candidate = path.join('tests', resolvedPath);
    if (fs.existsSync(candidate)) {
      resolvedPath = candidate;
    }
  }

  let sourceCodeSnippet = '';
  if (resolvedPath && fs.existsSync(resolvedPath)) {
    try {
      const fileContent = fs.readFileSync(resolvedPath, 'utf-8');
      const lines = fileContent.split('\n');
      const targetLine = failure.line ? failure.line - 1 : 0;
      const start = Math.max(0, targetLine - 10);
      const end = Math.min(lines.length, targetLine + 10);

      sourceCodeSnippet = lines
        .slice(start, end)
        .map((line, idx) => {
          const currentLineNum = start + idx + 1;
          const marker = currentLineNum === failure.line ? ' > ' : '   ';
          return `${marker}${currentLineNum.toString().padStart(4, ' ')} | ${line}`;
        })
        .join('\n');
    } catch {
      sourceCodeSnippet = 'Unable to read source file';
    }
  }

  let gitDiff = '';
  if (resolvedPath && fs.existsSync(resolvedPath)) {
    const tryGit = (cmd) => {
      try {
        return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      } catch {
        return '';
      }
    };

    // 1. Uncommitted working tree modifications (local dev changes)
    gitDiff = tryGit(`git diff HEAD -- "${resolvedPath}"`);

    // 2. Recent commit diff for this specific file on the branch (local branch history)
    if (!gitDiff) {
      gitDiff = tryGit(`git log -p -n 1 -- "${resolvedPath}"`);
    }

    // 3. Commit comparison vs HEAD~1
    if (!gitDiff) {
      gitDiff = tryGit(`git diff HEAD~1 -- "${resolvedPath}"`);
    }

    // 4. Branch comparison vs origin/main
    if (!gitDiff) {
      gitDiff = tryGit(`git diff origin/main...HEAD -- "${resolvedPath}"`);
    }
  }

  return {
    ...failure,
    filePath: resolvedPath,
    sourceCodeSnippet,
    gitDiff: gitDiff.slice(0, 1000), // Token guardrail limit
  };
}
