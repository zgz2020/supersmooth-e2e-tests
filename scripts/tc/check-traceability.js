#!/usr/bin/env node
/**
 * Test case traceability check.
 *
 * Verifies that the test case catalogue (`test-cases/**\/*.md`) and the Playwright tests stay in
 * sync, and prints a coverage summary:
 *
 *   - every Playwright test (except the `unit` project) is linked to exactly one case via `tc('<ID>')`
 *   - every linked ID exists in the catalogue
 *   - an ID is linked from one test declaration only (data-driven variants of it are fine)
 *   - every case marked `automated` has a linked test, and no linked case is marked otherwise
 *   - catalogue entries are well-formed (ID format, no duplicates, valid Priority / Automation)
 *
 * Usage:
 *   pnpm tc:check                              # lists tests with `playwright test --list`
 *   pnpm tc:check --list-file results.json     # reuse an existing JSON report / list output
 *   pnpm tc:check --report tc-coverage.md      # also write the coverage summary to a file
 *
 * When GITHUB_STEP_SUMMARY is set (GitHub Actions), the summary is appended to the job summary.
 * Exit code: 0 = in sync, 1 = traceability errors, 2 = tests could not be listed.
 *
 * See docs/test-case-management.md.
 */
import console from 'node:console';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import {
  AUTOMATION_STATUSES,
  CATALOGUE_DIR,
  ID_PATTERN,
  PRIORITIES,
  REPO_ROOT,
  TC_ANNOTATION_TYPE,
  loadCatalogue,
  parseCatalogueFile,
} from './catalogue.js';
import { isIndexUpToDate } from './case-index.js';

/** Playwright projects that are not product test cases (helper unit tests). */
export const EXCLUDED_PROJECTS = ['unit'];

// Re-exported so existing imports from this module keep working
export {
  AUTOMATION_STATUSES,
  CATALOGUE_DIR,
  ID_PATTERN,
  PRIORITIES,
  TC_ANNOTATION_TYPE,
  loadCatalogue,
  parseCatalogueFile,
};

/**
 * Flattens a Playwright JSON report (or `--list --reporter=json` output) into one entry per
 * test declaration, merging projects and data-driven variants declared at the same location.
 */
export function collectTests(report) {
  const declarations = new Map();
  const visit = (suite) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        if (EXCLUDED_PROJECTS.includes(test.projectName)) continue;
        const location = `tests/${spec.file}:${spec.line}`;
        const ids = (test.annotations ?? [])
          .filter((annotation) => annotation.type === TC_ANNOTATION_TYPE)
          .map((annotation) => annotation.description);
        const entry = declarations.get(location) ?? {
          location,
          titles: new Set(),
          ids: new Set(),
          projects: new Set(),
        };
        entry.titles.add(spec.title);
        ids.forEach((id) => entry.ids.add(id));
        entry.projects.add(test.projectName);
        declarations.set(location, entry);
      }
    }
    (suite.suites ?? []).forEach(visit);
  };
  (report.suites ?? []).forEach(visit);
  return [...declarations.values()].map((entry) => ({
    location: entry.location,
    title: [...entry.titles][0],
    variants: entry.titles.size,
    ids: [...entry.ids],
    projects: [...entry.projects],
  }));
}

/** Cross-checks catalogue and tests. Returns errors, warnings and coverage stats. */
export function validate(catalogue, tests) {
  const errors = [...catalogue.errors];
  const warnings = [];

  const casesById = new Map();
  for (const tc of catalogue.cases) {
    if (casesById.has(tc.id)) {
      const first = casesById.get(tc.id);
      errors.push(`${tc.file}:${tc.line} duplicate ID ${tc.id} (first defined in ${first.file})`);
      continue;
    }
    casesById.set(tc.id, tc);
  }

  const locationsById = new Map();
  for (const test of tests) {
    if (test.ids.length === 0) {
      errors.push(`${test.location} "${test.title}" is not linked to a test case: add tc('<ID>')`);
      continue;
    }
    if (test.ids.length > 1) {
      errors.push(
        `${test.location} "${test.title}" is linked to several cases (${test.ids.join(', ')})`,
      );
    }
    for (const id of test.ids) {
      if (!casesById.has(id)) {
        errors.push(`${test.location} references ${id}, which is not in the test-cases/ catalogue`);
      }
      const locations = locationsById.get(id) ?? [];
      locations.push(test.location);
      locationsById.set(id, locations);
    }
  }

  for (const [id, locations] of locationsById) {
    if (locations.length > 1) {
      errors.push(`${id} is linked from more than one test: ${locations.join(', ')}`);
    }
  }

  for (const tc of casesById.values()) {
    const linked = locationsById.has(tc.id);
    const where = `${tc.file}:${tc.line} ${tc.id}`;
    if (tc.automation === 'automated' && !linked) {
      errors.push(`${where} is marked automated but no test is linked to it`);
    }
    if (tc.automation && tc.automation !== 'automated' && linked) {
      errors.push(
        `${where} is linked from ${locationsById.get(tc.id)[0]} but marked "${tc.automation}"`,
      );
    }
    if (tc.automation && tc.automation !== 'automated' && !tc.hasSteps) {
      warnings.push(`${where} is ${tc.automation}: add **Steps** and **Expected result** sections`);
    }
  }

  const byFile = new Map();
  for (const tc of casesById.values()) {
    const row = byFile.get(tc.file) ?? { file: tc.file, total: 0 };
    row.total += 1;
    row[tc.automation] = (row[tc.automation] ?? 0) + 1;
    byFile.set(tc.file, row);
  }

  return {
    errors,
    warnings,
    stats: {
      cases: casesById.size,
      tests: tests.length,
      variants: tests.reduce((sum, test) => sum + test.variants, 0),
      byFile: [...byFile.values()],
    },
  };
}

export function renderSummary({ errors, warnings, stats }) {
  const columns = ['automated', 'manual', 'planned', 'not-automatable'];
  const totals = Object.fromEntries(columns.map((column) => [column, 0]));
  const rows = stats.byFile.map((row) => {
    columns.forEach((column) => (totals[column] += row[column] ?? 0));
    const automated = row.automated ?? 0;
    const percentage = row.total ? Math.round((automated / row.total) * 100) : 0;
    return `| \`${row.file}\` | ${row.total} | ${columns.map((c) => row[c] ?? 0).join(' | ')} | ${percentage}% |`;
  });
  const overall = stats.cases ? Math.round((totals.automated / stats.cases) * 100) : 0;

  const lines = [
    `## ${errors.length ? '❌' : '✅'} Test case traceability`,
    '',
    `${stats.cases} test cases · ${stats.tests} linked test declarations (${stats.variants} variants incl. data-driven) · ${overall}% automated`,
    '',
    '| Catalogue file | Cases | Automated | Manual | Planned | Not automatable | Automated % |',
    '| :-- | --: | --: | --: | --: | --: | --: |',
    ...rows,
    `| **Total** | **${stats.cases}** | ${columns.map((c) => `**${totals[c]}**`).join(' | ')} | **${overall}%** |`,
  ];
  if (errors.length)
    lines.push('', `### Errors (${errors.length})`, '', ...errors.map((e) => `- ${e}`));
  if (warnings.length) {
    lines.push('', `### Warnings (${warnings.length})`, '', ...warnings.map((w) => `- ${w}`));
  }
  return `${lines.join('\n')}\n`;
}

function listPlaywrightTests() {
  const outputFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tc-check-')), 'list.json');
  const result = spawnSync('npx', ['playwright', 'test', '--list', '--reporter=json'], {
    cwd: REPO_ROOT,
    env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: outputFile },
    encoding: 'utf-8',
  });
  if (!fs.existsSync(outputFile)) {
    console.error(result.stdout, result.stderr);
    throw new Error('`playwright test --list` did not produce a JSON report');
  }
  const report = JSON.parse(fs.readFileSync(outputFile, 'utf-8'));
  if (result.status !== 0 || report.errors?.length) {
    const messages = (report.errors ?? []).map((error) => error.message).join('\n');
    throw new Error(`\`playwright test --list\` failed:\n${messages || result.stderr}`);
  }
  return report;
}

function parseArgs(argv) {
  const args = { listFile: undefined, report: undefined };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--list-file') args.listFile = argv[++i];
    else if (argv[i] === '--report') args.report = argv[++i];
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let report;
  try {
    report = args.listFile
      ? JSON.parse(fs.readFileSync(path.resolve(args.listFile), 'utf-8'))
      : listPlaywrightTests();
  } catch (error) {
    console.error(`❌ Could not list Playwright tests: ${error.message}`);
    process.exit(2);
  }

  const catalogue = loadCatalogue();
  const result = validate(catalogue, collectTests(report));
  if (!catalogue.errors.length && !(await isIndexUpToDate(catalogue.cases))) {
    result.errors.push(
      'test-cases/README.md case index is out of date: run `pnpm tc:index` and commit the result',
    );
  }
  const summary = renderSummary(result);

  console.log(summary);
  if (args.report) fs.writeFileSync(path.resolve(args.report), summary);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);

  process.exit(result.errors.length ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`❌ tc:check failed: ${error.message}`);
    process.exit(1);
  });
}
