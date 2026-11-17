/**
 * Labelled triage dataset: one JSON file per case in tests/eval/triage/dataset/.
 * See tests/eval/triage/README.md for the labelling guide.
 */
import fs from 'node:fs';
import path from 'node:path';
import { CLASSES } from '../qa-agent/triage-core.js';

export const DEFAULT_DATASET_DIR = 'tests/eval/triage/dataset';
export const LABEL_SOURCES = ['fault-injection', 'real-failure', 'synthetic'];
export const DIFFICULTIES = ['easy', 'hard'];
/** Fields of extractFailureContext() the classifiers read. */
export const REQUIRED_FAILURE_FIELDS = [
  'testTitle',
  'filePath',
  'status',
  'errorSnippet',
  'stackTrace',
];
export const CASE_ID = /^TRI-\d{3}$/;

/** @returns {string[]} problems with one case (empty when valid) */
export function validateCase(testCase, fileName = '') {
  const where = fileName || testCase?.id || 'case';
  const errors = [];
  if (!CASE_ID.test(testCase?.id ?? '')) errors.push(`${where}: id must look like TRI-001`);
  if (fileName && testCase?.id && fileName !== `${testCase.id}.json`) {
    errors.push(`${where}: file name must be ${testCase.id}.json`);
  }
  if (!CLASSES.includes(testCase?.label)) {
    errors.push(`${where}: label must be one of ${CLASSES.join(', ')}`);
  }
  if (!LABEL_SOURCES.includes(testCase?.labelSource)) {
    errors.push(`${where}: labelSource must be one of ${LABEL_SOURCES.join(', ')}`);
  }
  if (!DIFFICULTIES.includes(testCase?.difficulty)) {
    errors.push(`${where}: difficulty must be easy or hard`);
  }
  if (!testCase?.notes) errors.push(`${where}: notes must explain the label`);
  const failure = testCase?.failure;
  if (!failure || typeof failure !== 'object') {
    errors.push(`${where}: missing failure`);
  } else {
    for (const field of REQUIRED_FAILURE_FIELDS) {
      if (typeof failure[field] !== 'string') errors.push(`${where}: failure.${field} is missing`);
    }
  }
  return errors;
}

/** Loads and validates every case. Throws with all problems listed when any case is invalid. */
export function loadDataset(dir = DEFAULT_DATASET_DIR) {
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort();
  const cases = [];
  const errors = [];
  const seen = new Set();
  for (const file of files) {
    let testCase;
    try {
      testCase = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
    } catch (err) {
      errors.push(`${file}: invalid JSON (${err.message})`);
      continue;
    }
    errors.push(...validateCase(testCase, file));
    if (seen.has(testCase.id)) errors.push(`${file}: duplicate id ${testCase.id}`);
    seen.add(testCase.id);
    cases.push(testCase);
  }
  if (errors.length) throw new Error(`Invalid triage dataset:\n- ${errors.join('\n- ')}`);
  return cases;
}

/** Next free id, e.g. TRI-014 when TRI-013 is the highest. */
export function nextCaseId(dir = DEFAULT_DATASET_DIR) {
  const ids = fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .map((f) => /^TRI-(\d{3})\.json$/.exec(f)?.[1])
        .filter(Boolean)
        .map(Number)
    : [];
  return `TRI-${String(Math.max(0, ...ids) + 1).padStart(3, '0')}`;
}

/** Counts per label, source and difficulty, for the docs and the eval report. */
export function datasetComposition(cases) {
  const count = (key, values) =>
    Object.fromEntries(values.map((v) => [v, cases.filter((c) => c[key] === v).length]));
  return {
    total: cases.length,
    byLabel: count('label', CLASSES),
    bySource: count('labelSource', LABEL_SOURCES),
    byDifficulty: count('difficulty', DIFFICULTIES),
  };
}
