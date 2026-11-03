import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { execSync } from 'node:child_process';

/**
 * 🧹 Automated Self-Healing Branch Retention & Pruning Utility (pnpm agent:cleanup-branches)
 *
 * Scans remote `ai-heal/*` branches created by autonomous repair runs.
 * Identifies and prunes branches that are:
 *   1. Already merged into main, OR
 *   2. Stale and exceeding the retention policy threshold (default: 30 days).
 */

function tryGit(command) {
  try {
    return execSync(command, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

/**
 * Lists all remote `ai-heal/*` branches with commit dates and merge status
 */
export function listRemoteHealBranches(options = {}) {
  const remote = options.remote || 'origin';
  const mainBranch = options.mainBranch || `${remote}/main`;

  // Sync and prune remote tracking references
  tryGit(`git fetch --prune ${remote}`);

  // Query branches matching refs/remotes/<remote>/ai-heal/*
  const format = '%(refname:short)|%(authordate:iso8601)|%(authordate:unix)';
  const rawOutput = tryGit(`git for-each-ref --format="${format}" refs/remotes/${remote}/ai-heal/`);

  if (!rawOutput) return [];

  const nowUnix = Math.floor(Date.now() / 1000);
  const branches = [];

  for (const line of rawOutput.split('\n')) {
    if (!line.trim()) continue;
    const [fullRef, dateStr, unixStr] = line.split('|');
    const branchName = fullRef.replace(`${remote}/`, '');
    const commitUnix = Number.parseInt(unixStr, 10) || nowUnix;
    const ageDays = Math.max(0, Math.floor((nowUnix - commitUnix) / 86400));

    // Check if branch is merged into main (ancestor check)
    const isAncestor = tryGit(`git merge-base --is-ancestor ${fullRef} ${mainBranch}`);
    const isMerged = isAncestor !== null;

    branches.push({
      ref: fullRef,
      branchName,
      date: dateStr,
      ageDays,
      isMerged,
    });
  }

  return branches;
}

/**
 * Evaluates branch retention criteria
 */
export function evaluateRetention(branches, options = {}) {
  const maxDays = options.days !== undefined ? Number(options.days) : 30;
  const includeMerged = options.includeMerged !== undefined ? options.includeMerged : true;

  const toDelete = [];
  const toRetain = [];

  for (const branch of branches) {
    if (includeMerged && branch.isMerged) {
      toDelete.push({ ...branch, reason: 'MERGED_INTO_MAIN' });
    } else if (branch.ageDays >= maxDays) {
      toDelete.push({ ...branch, reason: `STALE (Age: ${branch.ageDays}d >= ${maxDays}d)` });
    } else {
      toRetain.push({
        ...branch,
        reason: `ACTIVE_UNMERGED (Age: ${branch.ageDays}d < ${maxDays}d)`,
      });
    }
  }

  return { toDelete, toRetain, maxDays };
}

/**
 * Executes deletion of qualified branches
 */
export function pruneBranches(branchesToDelete, options = {}) {
  const remote = options.remote || 'origin';
  const isDryRun = options.isDryRun ?? false;
  const results = [];

  for (const branch of branchesToDelete) {
    if (isDryRun) {
      results.push({
        branchName: branch.branchName,
        status: 'WOULD_DELETE',
        reason: branch.reason,
      });
      continue;
    }

    const deleteCmd = `git push ${remote} --delete ${branch.branchName}`;
    try {
      execSync(deleteCmd, { stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf-8' });
      results.push({
        branchName: branch.branchName,
        status: 'DELETED',
        reason: branch.reason,
      });
    } catch (err) {
      results.push({
        branchName: branch.branchName,
        status: 'FAILED',
        reason: branch.reason,
        error: err.message,
      });
    }
  }

  return results;
}

/**
 * Formats Markdown report for GitHub Actions Step Summary
 */
export function generateStepSummaryMarkdown(evaluation, results, options = {}) {
  const { toDelete, toRetain, maxDays } = evaluation;
  const isDryRun = options.isDryRun ?? false;

  let md = `## 🧹 Autonomous Repair Branch Retention & Pruning\n\n`;
  md += `> **Policy Threshold:** Retention Window = **${maxDays} days** • Mode: **${isDryRun ? 'DRY-RUN (Simulated)' : 'ACTIVE PRUNING'}**\n\n`;

  md += `### 📊 Summary Overview\n\n`;
  md += `| Category | Count | Status |\n`;
  md += `| :--- | :--- | :--- |\n`;
  md += `| **Total Scanned** | ${toDelete.length + toRetain.length} branches | Scanned from \`ai-heal/*\` |\n`;
  md += `| **Pruned / To Delete** | **${toDelete.length}** | ${isDryRun ? 'Simulated' : 'Deleted from remote'} |\n`;
  md += `| **Retained Active** | ${toRetain.length} | Protected (< ${maxDays} days) |\n\n`;

  if (results.length > 0) {
    md += `### 🗑️ Pruned Branches\n\n`;
    md += `| Branch | Status | Reason |\n`;
    md += `| :--- | :--- | :--- |\n`;
    for (const res of results) {
      const icon = res.status === 'DELETED' ? '✅' : res.status === 'WOULD_DELETE' ? '🔍' : '❌';
      md += `| \`${res.branchName}\` | ${icon} **${res.status}** | ${res.reason} |\n`;
    }
    md += `\n`;
  }

  if (toRetain.length > 0) {
    md += `### 🛡️ Retained Branches\n\n`;
    md += `| Branch | Age | Merge Status |\n`;
    md += `| :--- | :--- | :--- |\n`;
    for (const b of toRetain) {
      md += `| \`${b.branchName}\` | ${b.ageDays} days | ${b.isMerged ? 'Merged' : 'Unmerged'} |\n`;
    }
    md += `\n`;
  }

  return md;
}

/**
 * CLI Main Entrypoint
 */
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isJson = args.includes('--json');

  const daysArg = args.find((a) => a.startsWith('--days='));
  const days = daysArg ? Number(daysArg.split('=')[1]) : 30;

  const remoteArg = args.find((a) => a.startsWith('--remote='));
  const remote = remoteArg ? remoteArg.split('=')[1] : 'origin';

  console.log('====================================================');
  console.log('🧹 [qa-agent:cleanup] Autonomous Repair Branch Retention');
  console.log('====================================================');
  console.log(`📡 Remote:   ${remote}`);
  console.log(`⏱️  Policy:   Retain unmerged branches < ${days} days (Prune merged automatically)`);
  console.log(`🔎 Mode:     ${isDryRun ? 'Dry Run (Preview Only)' : 'Active Deletion'}`);
  console.log('====================================================\n');

  const branches = listRemoteHealBranches({ remote });
  console.log(`🔍 Found ${branches.length} remote branch(es) matching 'ai-heal/*'.`);

  const evaluation = evaluateRetention(branches, { days });
  console.log(`🗑️  Identified ${evaluation.toDelete.length} branch(es) eligible for pruning.`);
  console.log(`🛡️  Identified ${evaluation.toRetain.length} active branch(es) to retain.\n`);

  const results = pruneBranches(evaluation.toDelete, { remote, isDryRun });

  if (isJson) {
    console.log(JSON.stringify({ evaluation, results }, null, 2));
    return;
  }

  for (const r of results) {
    const symbol = r.status === 'DELETED' ? '✅' : r.status === 'WOULD_DELETE' ? '🔍' : '❌';
    console.log(`${symbol} [${r.status}] ${r.branchName} — ${r.reason}`);
  }

  // Publish to Step Summary in GitHub Actions
  if (process.env.GITHUB_STEP_SUMMARY) {
    try {
      const markdown = generateStepSummaryMarkdown(evaluation, results, { isDryRun });
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown + '\n', 'utf-8');
      console.log('\n📋 Published report to $GITHUB_STEP_SUMMARY');
    } catch (err) {
      console.warn(`⚠️ Could not write to $GITHUB_STEP_SUMMARY: ${err.message}`);
    }
  }

  // Write local report artifact
  const reportsDir = path.resolve(process.cwd(), 'ai-reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(reportsDir, 'latest-branch-cleanup.json'),
    JSON.stringify({ evaluation, results }, null, 2),
    'utf-8',
  );

  console.log('\n🏁 [qa-agent:cleanup] Branch retention cleanup completed.\n');
}

if (process.argv[1] && process.argv[1].endsWith('cleanup-branches.js')) {
  main().catch((err) => {
    console.error(`❌ [qa-agent:cleanup] Error: ${err.message}`);
    process.exit(1);
  });
}
