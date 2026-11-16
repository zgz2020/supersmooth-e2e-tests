/**
 * Turns the failures of the last Playwright run into labelled triage dataset cases.
 *
 *   node scripts/eval/capture-case.js --label TRANSIENT_RPC --notes "API returned 429" \
 *     [--id TRI-017] [--match "<test title substring>"] [--all] [--difficulty hard] \
 *     [--source fault-injection] [--results test-results/results.json] \
 *     [--dataset tests/eval/triage/dataset] [--rewrite http://127.0.0.1:4455=https://staging.example]
 *
 * Without --all it captures the first failure (after --match). Every case is scrubbed of secrets
 * (patterns plus the literal values of secret variables in the environment and .env).
 * --rewrite replaces a string everywhere in the captured context, e.g. the address of a local
 * fault-injection proxy with the real base URL, so the case reads like a real run.
 * Run it from the checkout the tests ran in, so file paths, code snippets and git diffs resolve.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import console from 'node:console';
import dotenv from 'dotenv';
import { extractFailureContext } from '../qa-agent/extract-failure-context.js';
import { storableFailureContext } from '../qa-agent/triage-core.js';
import { DEFAULT_DATASET_DIR, nextCaseId, validateCase } from './dataset.js';
import { scrubDeep, secretEnvValues } from './scrub.js';

export function parseArgs(argv) {
  const args = { source: 'fault-injection', difficulty: 'easy', all: false };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '');
    if (key === 'all') args.all = true;
    else args[key] = argv[++i];
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const dataset = path.resolve(args.dataset || DEFAULT_DATASET_DIR);
  if (!args.label || !args.notes) {
    console.error('Usage: capture-case.js --label <CLASS> --notes "<why>" [options]');
    process.exit(2);
  }

  let failures = extractFailureContext(args.results || 'test-results/results.json');
  if (args.match) failures = failures.filter((f) => f.testTitle.includes(args.match));
  if (!failures.length) {
    console.error('No failures found in the last run (after --match).');
    process.exit(1);
  }
  if (!args.all) failures = failures.slice(0, 1);

  // Local checkout path → CI workspace path, as in a real CI failure
  const ciWorkspace = '/__w/sov-e2e-tests/sov-e2e-tests';
  failures = failures.map((f) =>
    JSON.parse(JSON.stringify(f).split(process.cwd()).join(ciWorkspace)),
  );
  if (args.rewrite) {
    const [from, to] = args.rewrite.split('=');
    failures = failures.map((f) => JSON.parse(JSON.stringify(f).split(from).join(to)));
  }

  fs.mkdirSync(dataset, { recursive: true });
  dotenv.config({ quiet: true });
  const secrets = secretEnvValues();
  failures.forEach((failure, index) => {
    const id = index === 0 && args.id ? args.id : nextCaseId(dataset);
    const testCase = {
      id,
      label: args.label,
      labelSource: args.source,
      difficulty: args.difficulty,
      notes: args.notes,
      capturedAt: new Date().toISOString().slice(0, 10),
      failure: scrubDeep(storableFailureContext(failure), { secrets }),
    };
    const errors = validateCase(testCase, `${id}.json`);
    if (errors.length) throw new Error(errors.join('\n'));
    fs.writeFileSync(path.join(dataset, `${id}.json`), `${JSON.stringify(testCase, null, 2)}\n`);
    console.log(`${id} ${args.label} ← ${failure.testTitle} (${failure.filePath}:${failure.line})`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
