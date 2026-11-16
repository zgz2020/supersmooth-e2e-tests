import assert from 'node:assert';
import console from 'node:console';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  CLASSES,
  callGeminiTriage,
  classifyFailure,
  storableFailureContext,
} from '../../scripts/qa-agent/triage-core.js';
import { sourceLabel } from '../../scripts/qa-agent/triage-agent.js';
import { healDecision } from '../../scripts/qa-agent/heal-agent.js';
import {
  calibration,
  classificationMetrics,
  confusionMatrix,
  consistency,
  fallbackRate,
} from '../../scripts/eval/metrics.js';
import { loadDataset, nextCaseId, validateCase } from '../../scripts/eval/dataset.js';
import { scrubDeep, scrubText, secretEnvValues } from '../../scripts/eval/scrub.js';
import {
  MAX_CONSECUTIVE_FALLBACKS,
  MAX_REPEATS,
  ProviderUnavailableError,
  parseArgs,
  runProvider,
  summarise,
} from '../../scripts/eval/triage-eval.js';

const [DRIFT, RPC, REGRESSION] = ['DOM_SELECTOR_DRIFT', 'TRANSIENT_RPC', 'REGRESSION_DEFECT'];

const failure = (errorSnippet) => ({
  testTitle: 'fixture test',
  filePath: 'tests/e2e/no-wallet/fixture.spec.ts',
  line: 10,
  status: 'failed',
  errorSnippet,
  stackTrace: '',
  sourceCodeSnippet: '',
  gitDiff: '',
});

const validCase = (overrides = {}) => ({
  id: 'TRI-001',
  label: RPC,
  labelSource: 'synthetic',
  difficulty: 'easy',
  notes: 'why',
  capturedAt: '2026-11-16',
  failure: failure('Error: socket hang up'),
  ...overrides,
});

async function runTests() {
  console.log('🧪 Running Triage Evaluation Unit Tests...\n');

  // Test 1: confusion matrix and precision / recall / F1 on a hand-computed fixture
  {
    // truth → predicted: DRIFT→DRIFT ×2, DRIFT→REG ×1, RPC→RPC ×1, REG→REG ×1, REG→DRIFT ×1
    const pairs = [
      { truth: DRIFT, predicted: DRIFT },
      { truth: DRIFT, predicted: DRIFT },
      { truth: DRIFT, predicted: REGRESSION },
      { truth: RPC, predicted: RPC },
      { truth: REGRESSION, predicted: REGRESSION },
      { truth: REGRESSION, predicted: DRIFT },
    ];
    const matrix = confusionMatrix(pairs, CLASSES);
    assert.strictEqual(matrix[DRIFT][DRIFT], 2);
    assert.strictEqual(matrix[DRIFT][REGRESSION], 1);
    assert.strictEqual(matrix[REGRESSION][DRIFT], 1);

    const m = classificationMetrics(pairs, CLASSES);
    assert.strictEqual(m.correct, 4);
    assert.strictEqual(m.accuracy, 4 / 6);
    // DRIFT: tp 2, predicted 3, support 3 → P 2/3, R 2/3, F1 2/3
    assert.strictEqual(m.perClass[DRIFT].precision, 2 / 3);
    assert.strictEqual(m.perClass[DRIFT].recall, 2 / 3);
    assert(Math.abs(m.perClass[DRIFT].f1 - 2 / 3) < 1e-12);
    // REGRESSION: tp 1, predicted 2, support 2 → P 1/2, R 1/2
    assert.strictEqual(m.perClass[REGRESSION].precision, 0.5);
    assert.strictEqual(m.perClass[RPC].f1, 1);
    // macro-F1 = mean(2/3, 1, 1/2)
    assert(Math.abs(m.macroF1 - (2 / 3 + 1 + 0.5) / 3) < 1e-12);
    console.log('  ✓ Test 1 Passed: confusion matrix and per-class P/R/F1');
  }

  // Test 2: a class never predicted (or absent) gives n/a (null), never NaN
  {
    const m = classificationMetrics(
      [
        { truth: RPC, predicted: DRIFT },
        { truth: DRIFT, predicted: DRIFT },
      ],
      CLASSES,
    );
    assert.strictEqual(m.perClass[RPC].precision, null, 'never predicted → precision n/a');
    assert.strictEqual(m.perClass[RPC].recall, 0);
    assert.strictEqual(m.perClass[RPC].f1, null);
    assert.strictEqual(m.perClass[REGRESSION].recall, null, 'no support → recall n/a');
    assert(!Object.values(m.perClass).some((c) => Number.isNaN(c.precision) || Number.isNaN(c.f1)));
    // DRIFT: predicted twice, right once → P 1/2, R 1, F1 2/3; RPC F1 null counts 0
    assert(Math.abs(m.macroF1 - (0 + 2 / 3) / 2) < 1e-12, 'macro-F1 over present classes');
    assert.strictEqual(classificationMetrics([], CLASSES).accuracy, null);
    console.log('  ✓ Test 2 Passed: divide-by-zero safety');
  }

  // Test 3: consistency across repeats and fallback rate
  {
    const c = consistency([[DRIFT, DRIFT, DRIFT], [RPC, REGRESSION, RPC], [DRIFT]]);
    assert.deepStrictEqual(c, { cases: 2, stable: 1, rate: 0.5 }, 'single-run cases are ignored');
    assert.strictEqual(consistency([[DRIFT]]).rate, null);
    const f = fallbackRate([
      { source: 'gemini' },
      { source: 'heuristic' },
      { source: 'gemini' },
      { source: 'gemini' },
    ]);
    assert.deepStrictEqual(f, { calls: 4, fellBack: 1, rate: 0.25 });
    console.log('  ✓ Test 3 Passed: consistency and fallback rate');
  }

  // Test 4: calibration bucketing at the boundaries
  {
    const buckets = calibration([
      { confidence: 69.9, correct: true },
      { confidence: 70, correct: false },
      { confidence: 84, correct: true },
      { confidence: 85, correct: true },
      { confidence: 94, correct: false },
      { confidence: 95, correct: true },
      { confidence: 100, correct: true },
    ]);
    const by = Object.fromEntries(buckets.map((b) => [b.bucket, b]));
    assert.strictEqual(by['<70'].count, 1);
    assert.strictEqual(by['70–84'].count, 2);
    assert.strictEqual(by['70–84'].accuracy, 0.5);
    assert.strictEqual(by['85–94'].count, 2);
    assert.strictEqual(by['≥95'].count, 2);
    assert.strictEqual(by['≥95'].accuracy, 1);
    assert.strictEqual(calibration([])[0].accuracy, null);
    console.log('  ✓ Test 4 Passed: calibration buckets');
  }

  // Test 5: dataset loader rejects unknown labels and missing failure fields
  {
    assert.deepStrictEqual(validateCase(validCase(), 'TRI-001.json'), []);
    assert(validateCase(validCase({ label: 'FLAKY' }))[0].includes('label'));
    const noSnippet = validCase();
    delete noSnippet.failure.errorSnippet;
    assert(validateCase(noSnippet).some((e) => e.includes('failure.errorSnippet')));
    assert(
      validateCase(validCase({ failure: undefined })).some((e) => e.includes('missing failure')),
    );
    assert(validateCase(validCase(), 'TRI-002.json').some((e) => e.includes('file name')));

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'triage-dataset-'));
    fs.writeFileSync(path.join(dir, 'TRI-001.json'), JSON.stringify(validCase()));
    assert.strictEqual(loadDataset(dir).length, 1);
    assert.strictEqual(nextCaseId(dir), 'TRI-002');
    fs.writeFileSync(
      path.join(dir, 'TRI-002.json'),
      JSON.stringify(validCase({ id: 'TRI-002', label: 'NOPE' })),
    );
    assert.throws(() => loadDataset(dir), /TRI-002.json: label must be one of/);
    fs.rmSync(dir, { recursive: true, force: true });

    // The committed dataset is valid and meets its composition targets
    const cases = loadDataset();
    assert(cases.length >= 30);
    for (const cls of CLASSES)
      assert(cases.filter((c) => c.label === cls).length >= 8, `≥ 8 ${cls}`);
    assert(
      cases.filter((c) => c.difficulty === 'hard').length / cases.length >= 0.25,
      '≥ 25% hard',
    );
    assert(
      cases.filter((c) => c.labelSource === 'synthetic').length / cases.length <= 0.3,
      '≤ 30% synthetic',
    );
    console.log('  ✓ Test 5 Passed: dataset validation and the committed dataset');
  }

  // Test 6: the scrubber removes key-bearing RPC URLs, private keys and secret env values
  {
    const pk = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const text = [
      'URL: https://base-mainnet.g.alchemy.com/v2/k3yABCdefGHIjklMNOpqrSTUvwx12345',
      'https://mainnet.infura.io/v3/0123456789abcdef0123456789abcdef',
      `https://rpc.example.org/?apikey=supersecretvalue&chain=1`,
      `private key 0x${pk} and ${pk}`,
      'https://discord.com/api/webhooks/123456/abcDEF_token',
      'at /Users/someone/repo/tests/a.spec.ts:1:1',
      'address 0x44E361c3D9dcd703D535f9c2883a4E104AD2F4d5 stays',
    ].join('\n');
    const out = scrubText(text);
    assert(!out.includes('k3yABCdefGHIjklMNOpqrSTUvwx12345'));
    assert(!out.includes('0123456789abcdef0123456789abcdef'));
    assert(!out.includes('supersecretvalue'));
    assert(!out.includes(pk));
    assert(!out.includes('abcDEF_token'));
    assert(!out.includes('/Users/someone/'));
    assert(out.includes('0x44E361c3D9dcd703D535f9c2883a4E104AD2F4d5'), '40-hex addresses are kept');

    const secrets = secretEnvValues({
      GEMINI_API_KEY: 'gm-very-secret-123',
      BASE_URL: 'https://x.y',
      SHORT_KEY: 'abc',
    });
    assert.deepStrictEqual(secrets, ['gm-very-secret-123']);
    const deep = scrubDeep({ a: ['token gm-very-secret-123'], n: 1 }, { secrets });
    assert.deepStrictEqual(deep, { a: ['token <redacted>'], n: 1 });
    console.log('  ✓ Test 6 Passed: scrubber');
  }

  // Test 7: classifier source and fallback reasons (no network: the HTTP call is mocked)
  {
    const f = failure(
      'TimeoutError: locator.click: Timeout 10000ms exceeded. waiting for getByRole(...)',
    );
    const heuristic = await classifyFailure(f, { provider: 'heuristic', apiKey: 'unused' });
    assert.strictEqual(heuristic.source, 'heuristic');
    assert.strictEqual(heuristic.classification, DRIFT);
    assert.strictEqual(heuristic.fallbackReason, undefined);
    assert.strictEqual((await classifyFailure(f, {})).source, 'heuristic', 'auto without key');

    const status429 = await callGeminiTriage(f, {
      apiKey: 'k',
      post: async () => ({ status: 429, body: 'quota' }),
    });
    assert.strictEqual(status429.source, 'heuristic');
    assert.strictEqual(status429.fallbackReason, 'http_429');

    const timeout = await callGeminiTriage(f, {
      apiKey: 'k',
      post: async () => {
        throw Object.assign(new Error('The operation was aborted due to timeout'), {
          name: 'TimeoutError',
        });
      },
    });
    assert.strictEqual(timeout.fallbackReason, 'timeout');

    const reply = (text) => async () => ({
      status: 200,
      body: JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }),
    });
    assert.strictEqual(
      (await callGeminiTriage(f, { apiKey: 'k', post: reply('not json') })).fallbackReason,
      'parse_error',
    );
    assert.strictEqual(
      (await callGeminiTriage(f, { apiKey: 'k', post: reply('{"classification":"FLAKY"}') }))
        .fallbackReason,
      'invalid_classification',
    );
    const ok = await callGeminiTriage(f, {
      apiKey: 'k',
      post: reply(JSON.stringify({ classification: RPC, confidenceScore: 77, rootCause: 'r' })),
    });
    assert.strictEqual(ok.source, 'gemini');
    assert.strictEqual(ok.classification, RPC);
    assert.strictEqual(ok.fallbackReason, undefined);

    assert.strictEqual(sourceLabel(ok), 'gemini');
    assert.strictEqual(sourceLabel(status429), 'heuristic (fallback: http_429)');
    assert.strictEqual(sourceLabel(heuristic), 'heuristic');

    const stored = storableFailureContext({
      ...f,
      gitDiff: 'x'.repeat(5000),
      attachments: [{ name: 'trace', contentType: 'application/zip', path: '/abs/trace.zip' }],
    });
    assert.strictEqual(stored.gitDiff.length, 2000);
    assert.deepStrictEqual(stored.attachments, [{ name: 'trace', contentType: 'application/zip' }]);
    console.log('  ✓ Test 7 Passed: classifier source, fallback reasons, stored context');
  }

  // Test 8: the runner caps repeats and summarises a mocked provider
  {
    assert.strictEqual(parseArgs(['--repeats', '9']).repeats, MAX_REPEATS);
    assert.throws(() => parseArgs(['--provider', 'gpt']), /--provider/);
    const cases = [
      validCase({ id: 'TRI-001', label: RPC, difficulty: 'easy' }),
      validCase({ id: 'TRI-002', label: DRIFT, difficulty: 'hard' }),
    ];
    let call = 0;
    // Run 1 gets both right; run 2 flips TRI-002 and falls back once
    const classify = async (f) => {
      call += 1;
      const answers = [RPC, DRIFT, RPC, REGRESSION];
      return {
        classification: answers[call - 1],
        confidenceScore: 90,
        source: call === 4 ? 'heuristic' : 'gemini',
        ...(call === 4 ? { fallbackReason: 'http_429' } : {}),
        f,
      };
    };
    const rows = await runProvider('gemini', cases, { repeats: 2, classify });
    assert.strictEqual(rows.length, 4);
    const s = summarise('gemini', cases, rows);
    assert.strictEqual(s.accuracy, 1, 'main metrics use the first run');
    assert.deepStrictEqual(s.accuracyByRepeat, [1, 0.5]);
    assert.deepStrictEqual(s.consistency, { cases: 2, stable: 1, rate: 0.5 });
    assert.strictEqual(s.fallback.fellBack, 1);
    assert.deepStrictEqual(s.fallbackReasons, { http_429: 1 });
    assert.strictEqual(s.calls, 4);
    const heuristicRows = await runProvider('heuristic', cases, { repeats: 3 });
    assert.strictEqual(heuristicRows.length, 2, 'the heuristic is deterministic: one run');

    // Gemini that keeps falling back (quota gone) is stopped, not reported as a Gemini score
    let quotaCalls = 0;
    const exhausted = async () => {
      quotaCalls += 1;
      return {
        classification: RPC,
        confidenceScore: 88,
        source: 'heuristic',
        fallbackReason: 'http_429',
      };
    };
    const many = Array.from({ length: 10 }, (_, i) =>
      validCase({ id: `TRI-${String(i + 1).padStart(3, '0')}` }),
    );
    await assert.rejects(
      runProvider('gemini', many, { classify: exhausted }),
      (err) => err instanceof ProviderUnavailableError && /http_429/.test(err.message),
    );
    assert.strictEqual(quotaCalls, MAX_CONSECUTIVE_FALLBACKS, 'stops right after the streak');
    console.log('  ✓ Test 8 Passed: runner repeats cap and summary');
  }

  // Test 9: heal decision rule (HEAL_POLICY)
  {
    const drift = {
      classification: DRIFT,
      confidenceScore: 95,
      source: 'gemini',
      replacement: { target: 'a', replacement: 'b' },
    };
    assert.strictEqual(healDecision(drift, { policy: 'legacy' }).heal, true);
    assert.strictEqual(
      healDecision(
        { ...drift, classification: RPC, replacement: null, selfHealingPatch: null },
        { policy: 'legacy' },
      ).heal,
      false,
    );
    const strict = { policy: 'evaluated', minConfidence: 90 };
    assert.strictEqual(healDecision(drift, strict).heal, true);
    assert.match(healDecision({ ...drift, source: 'heuristic' }, strict).reason, /heuristic/);
    assert.match(healDecision({ ...drift, confidenceScore: 80 }, strict).reason, /confidence/);
    assert.match(
      healDecision({ ...drift, classification: REGRESSION }, strict).reason,
      /DOM_SELECTOR_DRIFT/,
    );
    console.log('  ✓ Test 9 Passed: heal decision rule');
  }

  console.log('\n🎉 All 9 Triage Evaluation tests passed successfully!\n');
}

await runTests();
