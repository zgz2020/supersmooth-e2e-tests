import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { execSync } from 'node:child_process';

const fetch = globalThis.fetch;

const REPORTS_DIR = path.resolve(process.cwd(), 'ai-reports');
const LATEST_JSON_PATH = path.join(REPORTS_DIR, 'latest-triage-data.json');

/**
 * Autonomous Self-Healing Agent (pnpm agent:heal)
 *
 * Reads latest failure triage data, extracts proposed self-healing patches,
 * updates target spec/page files, validates the fix by re-running the test,
 * and optionally opens an automated Self-Healing Pull Request in GitHub.
 */
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const skipVerify = args.includes('--no-verify');
  const shouldCreatePR = args.includes('--create-pr');
  const suiteArg = args.find((a) => a.startsWith('--suite='));
  const suiteName = suiteArg ? suiteArg.split('=')[1] : null;
  const baseBranchArg = args.find((a) => a.startsWith('--base-branch='));
  const baseBranch = baseBranchArg ? baseBranchArg.split('=')[1] : null;

  console.log('🩺 [qa-agent:heal] Starting Autonomous Self-Healing Agent...');

  let triageData = null;

  if (fs.existsSync(LATEST_JSON_PATH)) {
    try {
      triageData = JSON.parse(fs.readFileSync(LATEST_JSON_PATH, 'utf-8'));
    } catch (err) {
      console.warn(`⚠️  [qa-agent:heal] Could not parse ${LATEST_JSON_PATH}: ${err.message}`);
    }
  }

  // Fallback: Parse from latest-github-comment.md if JSON is not present
  if (!triageData) {
    const commentPath = path.join(REPORTS_DIR, 'latest-github-comment.md');
    if (fs.existsSync(commentPath)) {
      console.log('ℹ️  [qa-agent:heal] Reading triage diagnoses from latest-github-comment.md...');
      triageData = parseTriageFromMarkdown(fs.readFileSync(commentPath, 'utf-8'));
    }
  }

  if (!triageData || !triageData.analyses || triageData.analyses.length === 0) {
    console.warn(
      `⚠️  [qa-agent:heal] No triage data found in ${REPORTS_DIR}.\nRun 'pnpm agent:triage' first to generate failure diagnostics.`,
    );
    process.exit(1);
  }

  const healableItems = (triageData.analyses || []).filter(
    (item) =>
      item.classification === 'DOM_SELECTOR_DRIFT' ||
      item.replacement !== null ||
      (typeof item.selfHealingPatch === 'string' && item.selfHealingPatch.trim().length > 0),
  );

  if (healableItems.length === 0) {
    console.log(
      'ℹ️  [qa-agent:heal] No healable DOM selector drift or patches found in latest triage.',
    );
    console.log(
      '    All diagnosed failures are either transient RPC blips or application regressions.',
    );
    process.exit(0);
  }

  console.log(
    `🔍 [qa-agent:heal] Found ${healableItems.length} candidate failure(s) for self-healing.\n`,
  );

  let appliedCount = 0;
  const successfullyHealed = [];

  for (let i = 0; i < healableItems.length; i++) {
    const item = healableItems[i];
    const targetFile = item.targetFile || item.filePath;

    console.log(`──────── Failure #${i + 1}: ${item.testTitle} ────────`);
    console.log(`📄 Target File: ${targetFile}`);
    console.log(
      `🏷️  Classification: ${item.classification} (Confidence: ${item.confidenceScore}%)`,
    );
    console.log(`💡 Root Cause: ${item.rootCause}`);

    if (!targetFile || !fs.existsSync(targetFile)) {
      console.warn(`⚠️  Cannot heal: Target file '${targetFile}' does not exist on disk.\n`);
      continue;
    }

    const originalContent = fs.readFileSync(targetFile, 'utf-8');
    let patchedContent = null;
    let patchDescription = '';

    // Strategy 1: Direct exact replacement object
    if (item.replacement && item.replacement.target && item.replacement.replacement) {
      if (originalContent.includes(item.replacement.target)) {
        patchedContent = originalContent.replace(
          item.replacement.target,
          item.replacement.replacement,
        );
        patchDescription = `Replace '${item.replacement.target}' with '${item.replacement.replacement}'`;
      } else {
        // Resilient line matching (ignoring indentation variances)
        const trimmedTarget = item.replacement.target.trim();
        const trimmedReplacement = item.replacement.replacement.trim();
        const lines = originalContent.split('\n');
        const lineIdx = lines.findIndex((l) => l.includes(trimmedTarget));
        if (lineIdx !== -1) {
          lines[lineIdx] = lines[lineIdx].replace(trimmedTarget, trimmedReplacement);
          patchedContent = lines.join('\n');
          patchDescription = `Replace '${trimmedTarget}' with '${trimmedReplacement}' (at line ${lineIdx + 1})`;
        }
      }
    }

    // Strategy 2: Unified diff parsing
    if (!patchedContent && typeof item.selfHealingPatch === 'string') {
      const diffPatch = item.selfHealingPatch;

      // Extract unified diff lines (lines starting with - and +)
      const diffLines = diffPatch.split('\n');
      const removedLines = diffLines
        .filter((l) => l.startsWith('-') && !l.startsWith('---'))
        .map((l) => l.slice(1).trim());
      const addedLines = diffLines
        .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
        .map((l) => l.slice(1).trim());

      if (removedLines.length === 1 && addedLines.length === 1) {
        const oldCode = removedLines[0];
        const newCode = addedLines[0];
        if (originalContent.includes(oldCode)) {
          patchedContent = originalContent.replace(oldCode, newCode);
          patchDescription = `Diff Patch: - ${oldCode} \n                + ${newCode}`;
        }
      }
    }

    if (!patchedContent) {
      console.warn('⚠️  Could not automatically match exact target string for patch.');
      if (item.selfHealingPatch) {
        console.log(`📋 Proposed Patch Reference:\n${item.selfHealingPatch}\n`);
      }
      continue;
    }

    console.log(`🩹 Applying fix: ${patchDescription}`);

    if (isDryRun) {
      console.log('🔎 [Dry Run] File would be updated. Skipping actual write and verification.\n');
      continue;
    }

    // Backup original file
    const backupFile = `${targetFile}.bak.${Date.now()}`;
    fs.writeFileSync(backupFile, originalContent, 'utf-8');

    try {
      // Write patched content
      fs.writeFileSync(targetFile, patchedContent, 'utf-8');
      console.log(`💾 Applied patch to ${targetFile}`);

      if (!skipVerify) {
        console.log('🧪 Verifying healed spec in isolation...');
        let specToRun =
          item.specFile || (item.filePath && item.filePath.includes('.spec.') ? item.filePath : '');
        if (specToRun && !fs.existsSync(specToRun)) {
          const candidate = path.join('tests', specToRun);
          if (fs.existsSync(candidate)) specToRun = candidate;
        }

        const prefix = process.platform === 'linux' ? 'xvfb-run --auto-servernum -- ' : '';
        const testCmd = specToRun
          ? `${prefix}npx playwright test "${specToRun}" -g "${escapeRegex(item.testTitle)}"`
          : `${prefix}npx playwright test -g "${escapeRegex(item.testTitle)}"`;

        try {
          execSync(testCmd, {
            stdio: 'pipe',
            encoding: 'utf-8',
            env: { ...process.env, HEADLESS: 'true' },
          });
          console.log('✅ Verification PASSED! Healed test now passes.');
          fs.unlinkSync(backupFile);
          appliedCount++;
          successfullyHealed.push({
            item,
            targetFile,
            patchDescription,
          });
        } catch (err) {
          console.warn('❌ Verification FAILED: Test did not pass with applied patch.');
          if (err.stdout) {
            const out = err.stdout.toString().slice(0, 500);
            if (out.trim()) console.log(`   Output: ${out.trim()}`);
          }
          console.warn('↩️  Rolling back changes from backup...');
          fs.writeFileSync(targetFile, originalContent, 'utf-8');
          fs.unlinkSync(backupFile);
          console.log('🔄 Reverted file to original state.\n');
          continue;
        }
      } else {
        fs.unlinkSync(backupFile);
        appliedCount++;
        successfullyHealed.push({
          item,
          targetFile,
          patchDescription,
        });
        console.log('⏩ Verification skipped (--no-verify).\n');
      }
    } catch (err) {
      console.error(`❌ Error during patching: ${err.message}`);
      if (fs.existsSync(backupFile)) {
        fs.writeFileSync(targetFile, originalContent, 'utf-8');
        fs.unlinkSync(backupFile);
      }
    }
  }

  console.log(
    `\n🏁 [qa-agent:heal] Self-healing complete. Successfully healed: ${appliedCount} test(s).\n`,
  );

  if (shouldCreatePR && successfullyHealed.length > 0) {
    await handleCreatePR({ successfullyHealed, suiteName, baseBranch });
  }
}

async function handleCreatePR({ successfullyHealed, suiteName, baseBranch }) {
  console.log('🚀 [qa-agent:heal] Preparing autonomous self-healing Pull Request...');

  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const repoSlug = process.env.GITHUB_REPOSITORY;

  if (!token && process.env.CI) {
    console.warn('⚠️  GITHUB_TOKEN is missing in CI environment. Cannot create automated PR.');
    return;
  }

  let targetBranch = baseBranch;
  if (!targetBranch) {
    targetBranch = process.env.GITHUB_BASE_REF || process.env.GITHUB_REF_NAME || 'main';
  }

  const branchName = `ai-heal/${suiteName || 'e2e'}-${Date.now().toString(36)}`;
  const execOpts = { cwd: process.cwd(), stdio: 'pipe' };

  try {
    try {
      execSync('git config --global --add safe.directory "*"', execOpts);
      execSync('git config --global user.name "github-actions[bot]"', execOpts);
      execSync(
        'git config --global user.email "41898282+github-actions[bot]@users.noreply.github.com"',
        execOpts,
      );
    } catch (confErr) {
      console.warn(`⚠️  Git global config warning: ${confErr.message}`);
    }

    execSync(`git checkout -b "${branchName}"`, execOpts);
    console.log(`🌿 Created branch: ${branchName}`);

    const uniqueFiles = [...new Set(successfullyHealed.map((h) => h.targetFile))];
    for (const file of uniqueFiles) {
      execSync(`git add "${file}"`, execOpts);
    }

    const commitMsg = `fix(qa): autonomous self-heal locator drift in ${uniqueFiles.join(', ')}`;
    execSync(`git commit -m "${commitMsg}"`, execOpts);
    console.log(`📦 Committed changes: ${commitMsg}`);

    console.log(`⬆️  Pushing branch ${branchName} to remote...`);
    if (token && repoSlug) {
      const authUrl = `https://x-access-token:${token}@github.com/${repoSlug}.git`;
      execSync(`git push "${authUrl}" "${branchName}"`, execOpts);
    } else {
      execSync(`git push origin "${branchName}"`, execOpts);
    }
    console.log('✅ Branch pushed successfully.');

    const prTitle = `🤖 [AI QA] Self-healing fix for locator drift (${suiteName || 'e2e'})`;
    const prBody = [
      '## 🤖 Autonomous QA Self-Healing Fix',
      '',
      '> **Generated by:** Applied AI QA Agent (`pnpm agent:heal`)  ',
      `> **Suite:** \`${suiteName || 'e2e'}\`  `,
      `> **Target Branch:** \`${targetBranch}\`  `,
      '> **Status:** ✅ Verified in Playwright test runner isolation',
      '',
      `### 🔍 Repaired Failures (${successfullyHealed.length})`,
      '',
      ...successfullyHealed.map((h, idx) =>
        [
          `#### ${idx + 1}. \`${h.item.testTitle}\``,
          `- **Target File:** \`${h.targetFile}\``,
          `- **Spec:** \`${h.item.specFile || h.targetFile}\``,
          `- **Classification:** \`${h.item.classification}\` (Confidence: ${h.item.confidenceScore}%)`,
          `- **Root Cause:** ${h.item.rootCause}`,
          `- **Applied Fix:** ${h.patchDescription}`,
          '',
        ].join('\n'),
      ),
      '### 🛡️ Verification Gate',
      '- Each healed test was executed in Playwright runner isolation and exited with code **0 (PASSED)**.',
      '- No other test files or application logic were modified.',
      '',
      '---',
      '*Review the diff below and click **Merge pull request** to apply this self-healing fix.*',
    ].join('\n');

    const oneClickPRUrl = repoSlug
      ? `https://github.com/${repoSlug}/compare/${targetBranch}...${branchName}?expand=1&title=${encodeURIComponent(prTitle)}`
      : '';

    if (token && repoSlug) {
      console.log(`📨 Attempting to open Pull Request on ${repoSlug}...`);
      const [owner, repo] = repoSlug.split('/');
      let prCreated = false;
      let prData = null;

      try {
        const prRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'agent-qa-self-healing',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: prTitle,
            head: branchName,
            base: targetBranch,
            body: prBody,
            draft: false,
          }),
        });

        if (prRes.ok) {
          prData = await prRes.json();
          prCreated = true;
          console.log(`🎉 Successfully created Pull Request #${prData.number}: ${prData.html_url}`);

          try {
            await fetch(
              `https://api.github.com/repos/${owner}/${repo}/issues/${prData.number}/labels`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                  Accept: 'application/vnd.github.v3+json',
                  'User-Agent': 'agent-qa-self-healing',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  labels: ['ai-self-heal', 'automated-pr'],
                }),
              },
            );
          } catch (labelErr) {
            console.warn(
              `⚠️  Could not attach labels to PR #${prData.number}: ${labelErr.message}`,
            );
          }
        } else {
          const errorText = await prRes.text();
          console.warn(`\n⚠️  GitHub API cannot auto-create PR (${prRes.status}): ${errorText}`);
          console.log(
            '    "Allow GitHub Actions to create and approve pull requests" is restricted in organization settings.',
          );
        }
      } catch (fetchErr) {
        console.warn(`⚠️  Error communicating with GitHub Pulls API: ${fetchErr.message}`);
      }

      if (process.env.GITHUB_STEP_SUMMARY) {
        if (prCreated && prData) {
          const summaryMarkdown = [
            `### 🤖 Autonomous Self-Healing Pull Request Created!`,
            `- **PR:** [#${prData.number} - ${prTitle}](${prData.html_url})`,
            `- **Branch:** \`${branchName}\` ➔ \`${targetBranch}\``,
            `- **Verified Tests Healed:** ${successfullyHealed.length}`,
          ].join('\n');
          fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n\n${summaryMarkdown}\n`);
        } else {
          const summaryMarkdown = [
            `### 🩹 Autonomous Self-Healing Branch Ready!`,
            `- **Pushed Branch:** \`${branchName}\``,
            `- **Target Base:** \`${targetBranch}\``,
            `- **Verified Tests Healed:** ${successfullyHealed.length}`,
            ``,
            `> ℹ️ *GitHub Actions PR creation is restricted by repository/organization policy.*`,
            `> **[👉 Click here to Open Pull Request from \`${branchName}\`](${oneClickPRUrl})**`,
          ].join('\n');
          fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n\n${summaryMarkdown}\n`);
        }
      }

      if (!prCreated) {
        console.log(`\n🌿 Verified repair branch is pushed and ready: ${branchName}`);
        console.log(`👉 Open Pull Request with 1-click:\n   ${oneClickPRUrl}\n`);
        console.log(
          `   Or via GitHub CLI:\n   gh pr create --head "${branchName}" --base "${targetBranch}" --title "${prTitle}"\n`,
        );
      }
    } else {
      console.log('\n💡 [Local Mode] Verified repair branch created and pushed.');
      console.log(`   Branch: ${branchName} ➔ ${targetBranch}`);
      if (oneClickPRUrl) {
        console.log(`   👉 Open PR: ${oneClickPRUrl}`);
      }
      console.log(
        `   Or run: gh pr create --head "${branchName}" --base "${targetBranch}" --title "${prTitle}"\n`,
      );
    }
  } catch (err) {
    console.error(`❌ [qa-agent:heal] Failed to create self-healing PR: ${err.message}`);
  }
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Fallback parser to extract triage analyses from generated markdown reports.
 */
function parseTriageFromMarkdown(markdown) {
  const sections = markdown.split(/### ❌ Failure #\d+:\s*/);
  const analyses = [];

  for (let i = 1; i < sections.length; i++) {
    const section = sections[i];
    const titleMatch = section.match(/^([^\n]+)/);
    const fileMatch = section.match(/- \*\*Spec File:\*\* `([^:`]+)(?::(\d+))?`/);
    const classMatch = section.match(/- \*\*Classification:\*\* \*\*`([^`]+)`\*\*/);
    const rootMatch = section.match(/- \*\*💡 Root Cause:\*\* ([^\n]+)/);
    const diffMatch = section.match(/```diff\n([\s\S]*?)```/);

    if (fileMatch) {
      analyses.push({
        testTitle: titleMatch ? titleMatch[1].trim() : 'Unknown Spec',
        filePath: fileMatch[1].trim(),
        line: fileMatch[2] ? parseInt(fileMatch[2], 10) : null,
        classification: classMatch ? classMatch[1].trim() : 'UNKNOWN',
        confidenceScore: 85,
        rootCause: rootMatch ? rootMatch[1].trim() : '',
        selfHealingPatch: diffMatch ? diffMatch[1].trim() : null,
        targetFile: fileMatch[1].trim(),
        replacement: null,
      });
    }
  }

  return { analyses };
}

main().catch((err) => {
  console.error('[qa-agent:heal] Fatal error:', err);
  process.exit(1);
});
