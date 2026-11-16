/**
 * Quality metrics history: one JSON run record per line (`history.jsonl`).
 *
 * CI keeps the file on the orphan `metrics-data` branch (never on `main`); local runs write to
 * `.metrics/history.jsonl` (git-ignored). Records are keyed by `runId` + `suite`, so collecting
 * the same run twice (a re-run, or a retried push) replaces the record instead of duplicating it.
 *
 * See docs/quality-metrics.md.
 */
import fs from 'node:fs';
import path from 'node:path';

import { REPO_ROOT } from '../tc/catalogue.js';

/** Retention cap: runs kept per suite (oldest are dropped on write). */
export const MAX_RUNS_PER_SUITE = 200;

export const DEFAULT_HISTORY_PATH = path.join(REPO_ROOT, '.metrics', 'history.jsonl');

const runKey = (record) => `${record.runId}::${record.suite}`;
const byStart = (a, b) => String(a.startedAt).localeCompare(String(b.startedAt));

/** Parses JSONL text into run records. Blank lines are ignored; a corrupt line is an error. */
export function parseHistory(text) {
  return text
    .split(/\r?\n/)
    .map((line, index) => ({ line: line.trim(), index }))
    .filter(({ line }) => line)
    .map(({ line, index }) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`history line ${index + 1} is not valid JSON: ${error.message}`);
      }
    });
}

export function serializeHistory(records) {
  return records.map((record) => JSON.stringify(record)).join('\n') + (records.length ? '\n' : '');
}

/** Adds records, replacing any existing record with the same `runId` + `suite`. Sorted by start. */
export function upsertRuns(history, records) {
  const byKey = new Map(history.map((record) => [runKey(record), record]));
  for (const record of records) byKey.set(runKey(record), record);
  return [...byKey.values()].sort(byStart);
}

/** Keeps the most recent `max` runs of each suite. */
export function trimHistory(records, max = MAX_RUNS_PER_SUITE) {
  const kept = new Set();
  const bySuite = new Map();
  for (const record of [...records].sort(byStart)) {
    const runs = bySuite.get(record.suite) ?? [];
    runs.push(record);
    bySuite.set(record.suite, runs);
  }
  for (const runs of bySuite.values()) runs.slice(-max).forEach((record) => kept.add(record));
  return records.filter((record) => kept.has(record)).sort(byStart);
}

export function readHistory(file) {
  return fs.existsSync(file) ? parseHistory(fs.readFileSync(file, 'utf-8')) : [];
}

export function writeHistory(file, records) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, serializeHistory(records));
}
