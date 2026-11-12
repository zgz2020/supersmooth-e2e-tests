/**
 * Test case catalogue: shared constants and parser.
 *
 * Single source of truth used by both `pnpm tc:check` (scripts/tc/check-traceability.js) and the
 * `tc()` helper (utils/testCase.ts), so ID rules and priorities can never drift apart.
 * Plain ES module so Node scripts can import it directly; types in catalogue.d.ts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const CATALOGUE_DIR = path.join(REPO_ROOT, 'test-cases');
export const TC_ANNOTATION_TYPE = 'tc';
export const ID_PATTERN = /^(API|E2E|PERF)-[A-Z0-9]+-\d{3}$/;
export const PRIORITIES = ['P1', 'P2', 'P3'];
export const AUTOMATION_STATUSES = ['automated', 'manual', 'planned', 'not-automatable'];

const CASE_HEADING = /^##\s+(\S+?):\s+(.+?)\s*$/;
const FIELD_LINE = /^-\s+\*\*([A-Za-z ]+):\*\*\s*(.*?)\s*$/;

/**
 * Parses one catalogue markdown file.
 * @param {string} content
 * @param {string} file - path used in messages (relative to repo root)
 */
export function parseCatalogueFile(content, file) {
  const cases = [];
  const errors = [];
  const lines = content.split(/\r?\n/);
  let current = null;

  const close = () => {
    if (!current) return;
    const body = current.bodyLines.join('\n');
    current.hasSteps = /\*\*Steps\*\*/i.test(body) && /\*\*Expected/i.test(body);
    delete current.bodyLines;
    cases.push(current);
  };

  lines.forEach((line, index) => {
    if (line.startsWith('## ')) {
      close();
      const match = line.match(CASE_HEADING);
      if (!match) {
        errors.push(`${file}:${index + 1} heading must look like "## <ID>: <title>"`);
        current = null;
        return;
      }
      current = {
        id: match[1],
        title: match[2],
        file,
        line: index + 1,
        fields: {},
        bodyLines: [],
      };
      return;
    }
    if (!current) return;
    const field = line.match(FIELD_LINE);
    if (field) current.fields[field[1].trim().toLowerCase()] = field[2];
    current.bodyLines.push(line);
  });
  close();

  for (const tc of cases) {
    const where = `${tc.file}:${tc.line} ${tc.id}`;
    if (!ID_PATTERN.test(tc.id)) {
      errors.push(`${where} invalid ID (expected <API|E2E|PERF>-<AREA>-<NNN>)`);
    }
    tc.priority = tc.fields.priority;
    tc.automation = tc.fields.automation;
    if (!PRIORITIES.includes(tc.priority)) {
      errors.push(`${where} Priority must be one of ${PRIORITIES.join(', ')}`);
    }
    if (!AUTOMATION_STATUSES.includes(tc.automation)) {
      errors.push(`${where} Automation must be one of ${AUTOMATION_STATUSES.join(', ')}`);
    }
  }
  return { cases, errors };
}

/** Loads every `*.md` file under the catalogue directory (README.md files are documentation). */
export function loadCatalogue(dir = CATALOGUE_DIR) {
  const files = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.md') && entry.name !== 'README.md') files.push(full);
    }
  };
  if (fs.existsSync(dir)) walk(dir);

  const cases = [];
  const errors = [];
  for (const file of files.sort()) {
    const relative = path.relative(REPO_ROOT, file);
    const parsed = parseCatalogueFile(fs.readFileSync(file, 'utf-8'), relative);
    cases.push(...parsed.cases);
    errors.push(...parsed.errors);
  }
  return { cases, errors };
}

/** Playwright tag derived from a case priority, e.g. `P1` -> `@p1` (run with `--grep @p1`). */
export function priorityTag(priority) {
  return PRIORITIES.includes(priority) ? `@${priority.toLowerCase()}` : undefined;
}
