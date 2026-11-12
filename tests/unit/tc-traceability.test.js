import assert from 'node:assert';
import console from 'node:console';
import {
  parseCatalogueFile,
  collectTests,
  validate,
  renderSummary,
} from '../../scripts/tc/check-traceability.js';

const catalogueFixture = `# Fixture area

## API-FIX-001: Automated case

- **Priority:** P1
- **Automation:** automated

## API-FIX-002: Manual case with steps

- **Priority:** P2
- **Automation:** manual

**Steps**

1. Do something

**Expected result**

- Something happens

## API-FIX-003: Planned case without steps

- **Priority:** P3
- **Automation:** planned
`;

const spec = (file, line, title, ids, projectName = 'api') => ({
  file,
  line,
  title,
  tests: [
    {
      projectName,
      annotations: ids.map((id) => ({ type: 'tc', description: id })),
    },
  ],
});

const report = (...specs) => ({ suites: [{ title: 'fixture.spec.ts', specs, suites: [] }] });

function runTests() {
  console.log('🧪 Running Test Case Traceability Unit Tests...\n');

  const catalogue = parseCatalogueFile(catalogueFixture, 'test-cases/api/fixture.md');

  // Test 1: Catalogue parsing reads IDs, titles, fields and steps
  {
    assert.deepStrictEqual(catalogue.errors, []);
    assert.strictEqual(catalogue.cases.length, 3);
    assert.strictEqual(catalogue.cases[0].id, 'API-FIX-001');
    assert.strictEqual(catalogue.cases[0].title, 'Automated case');
    assert.strictEqual(catalogue.cases[0].priority, 'P1');
    assert.strictEqual(catalogue.cases[1].automation, 'manual');
    assert.strictEqual(catalogue.cases[1].hasSteps, true);
    assert.strictEqual(catalogue.cases[2].hasSteps, false);
    console.log('  ✓ Test 1 Passed: catalogue parsing');
  }

  // Test 2: Malformed catalogue entries are reported
  {
    const broken = parseCatalogueFile(
      '## bad-id: Title\n\n- **Priority:** P9\n- **Automation:** maybe\n\n## Missing colon\n',
      'test-cases/broken.md',
    );
    assert.strictEqual(broken.errors.length, 4);
    assert(broken.errors.some((e) => e.includes('invalid ID')));
    assert(broken.errors.some((e) => e.includes('Priority must be')));
    assert(broken.errors.some((e) => e.includes('Automation must be')));
    assert(broken.errors.some((e) => e.includes('heading must look like')));
    console.log('  ✓ Test 2 Passed: malformed entries reported');
  }

  // Test 3: Data-driven variants and projects at one location collapse into one declaration
  {
    const tests = collectTests(
      report(
        spec('api/a.spec.ts', 10, 'variant 1', ['API-FIX-001']),
        spec('api/a.spec.ts', 10, 'variant 2', ['API-FIX-001'], 'api-regression'),
        spec('unit/helper.spec.ts', 5, 'helper', [], 'unit'),
      ),
    );
    assert.strictEqual(tests.length, 1, 'unit project is excluded and variants are merged');
    assert.strictEqual(tests[0].variants, 2);
    assert.deepStrictEqual(tests[0].projects, ['api', 'api-regression']);
    console.log('  ✓ Test 3 Passed: declarations collapse variants and skip unit project');
  }

  // Test 4: A catalogue fully in sync produces no errors, and warns about a planned case without steps
  {
    const result = validate(
      catalogue,
      collectTests(report(spec('api/a.spec.ts', 10, 'automated', ['API-FIX-001']))),
    );
    assert.deepStrictEqual(result.errors, []);
    assert.strictEqual(result.warnings.length, 1);
    assert(result.warnings[0].includes('API-FIX-003'));
    assert(renderSummary(result).includes('✅ Test case traceability'));
    console.log('  ✓ Test 4 Passed: in-sync catalogue passes');
  }

  // Test 5: Unlinked tests, unknown IDs, duplicate links and status mismatches fail the check
  {
    const result = validate(
      catalogue,
      collectTests(
        report(
          spec('api/a.spec.ts', 10, 'no id', []),
          spec('api/a.spec.ts', 20, 'unknown id', ['API-FIX-999']),
          spec('api/a.spec.ts', 30, 'linked manual case', ['API-FIX-002']),
          spec('api/b.spec.ts', 5, 'duplicate link 1', ['API-FIX-002']),
        ),
      ),
    );
    const has = (text) => result.errors.some((e) => e.includes(text));
    assert(has('is not linked to a test case'));
    assert(has('API-FIX-999, which is not in the test-cases/ catalogue'));
    assert(has('API-FIX-002 is linked from more than one test'));
    assert(has('but marked "manual"'));
    assert(has('API-FIX-001 is marked automated but no test is linked to it'));
    assert(renderSummary(result).includes('❌ Test case traceability'));
    console.log('  ✓ Test 5 Passed: sync errors detected');
  }

  // Test 6: Duplicate IDs across catalogue files are rejected
  {
    const duplicate = parseCatalogueFile(catalogueFixture, 'test-cases/api/copy.md');
    const merged = {
      cases: [...catalogue.cases, ...duplicate.cases],
      errors: [],
    };
    const result = validate(merged, []);
    assert(result.errors.some((e) => e.includes('duplicate ID API-FIX-001')));
    console.log('  ✓ Test 6 Passed: duplicate IDs rejected');
  }

  console.log('\n🎉 All 6 Test Case Traceability tests passed successfully!\n');
}

runTests();
