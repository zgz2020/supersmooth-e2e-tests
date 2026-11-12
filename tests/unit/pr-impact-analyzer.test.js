import assert from 'node:assert';
import console from 'node:console';
import { analyzeImpact, getChangedFiles } from '../../scripts/qa-agent/pr-impact-analyzer.js';

/**
 * Self-verification test suite for AI Change-Impact Analyzer
 */
function runTests() {
  console.log('🧪 Running AI Change-Impact Analyzer Unit Tests...');

  // Test 1: Documentation-only changes should skip execution
  {
    const analysis = analyzeImpact(['README.md', 'docs/wallet-setup.md', 'TODO.md']);
    assert.strictEqual(analysis.runType, 'SKIP_DOCS');
    assert.strictEqual(analysis.hasTargetedTests, false);
    assert.strictEqual(analysis.savingsPercentage, '100%');
    console.log('  ✓ Test 1 Passed: Documentation files trigger SKIP_DOCS');
  }

  // Test 2: Core configuration changes should trigger FULL regression
  {
    const analysis = analyzeImpact(['package.json']);
    assert.strictEqual(analysis.runType, 'FULL');
    assert.strictEqual(analysis.hasTargetedTests, true);
    assert.strictEqual(analysis.savingsPercentage, '0%');
    console.log('  ✓ Test 2 Passed: Core package.json triggers FULL regression');
  }

  // Test 3: Vault page changes should trigger vault and open position specs
  {
    const analysis = analyzeImpact(['src/pages/vaultPage.ts']);
    assert.strictEqual(analysis.runType, 'TARGETED');
    assert.strictEqual(analysis.hasTargetedTests, true);
    assert(analysis.targetSpecs.includes('tests/e2e/no-wallet/vaultPages.spec.ts'));
    assert(analysis.targetSpecs.includes('tests/e2e/with-wallet/openPosition.spec.ts'));
    assert.strictEqual(analysis.hasWalletTests, true);
    assert(analysis.savingsPercentage.includes('%'));
    console.log('  ✓ Test 3 Passed: Vault page correctly maps to vault specs');
  }

  // Test 4: Product navigation changes should trigger earn & productsNavigation specs
  {
    const analysis = analyzeImpact(['src/pages/earn.ts', 'src/pages/borrow.ts']);
    assert.strictEqual(analysis.runType, 'TARGETED');
    assert(analysis.targetSpecs.includes('tests/e2e/no-wallet/earnProductsPage.spec.ts'));
    assert(analysis.targetSpecs.includes('tests/e2e/no-wallet/productsNavigation.spec.ts'));
    assert.strictEqual(analysis.hasWalletTests, false);
    console.log('  ✓ Test 4 Passed: Product pages map to earn and products navigation');
  }

  // Test 5: API schema changes should trigger corresponding API spec
  {
    const analysis = analyzeImpact(['utils/schema/api/complianceGeoSchema.ts']);
    assert.strictEqual(analysis.runType, 'TARGETED');
    assert(analysis.targetSpecs.includes('tests/api/complianceGeo.spec.ts'));
    assert(analysis.targetProjects.includes('api'));
    console.log('  ✓ Test 5 Passed: Compliance schema maps to compliance API specs');
  }

  // Test 6: Direct test spec modification should map directly to itself
  {
    const analysis = analyzeImpact(['tests/e2e/no-wallet/connectWallet.spec.ts']);
    assert.strictEqual(analysis.runType, 'TARGETED');
    assert(analysis.targetSpecs.includes('tests/e2e/no-wallet/connectWallet.spec.ts'));
    assert(analysis.targetProjects.includes('no-wallet'));
    console.log('  ✓ Test 6 Passed: Direct spec modification includes itself');
  }

  // Test 7: Empty changed files list
  {
    const analysis = analyzeImpact([]);
    assert.strictEqual(analysis.runType, 'NO_CHANGES');
    assert.strictEqual(analysis.hasTargetedTests, false);
    console.log('  ✓ Test 7 Passed: Empty files list returns NO_CHANGES');
  }

  // Test 8: Manual file overrides with whitespace padding should be trimmed cleanly
  {
    const cleaned = getChangedFiles({
      filesOverride: ['  src/pages/vaultPage.ts  ', '   ', ' src/pages/earn.ts '],
    });
    assert.deepStrictEqual(cleaned, ['src/pages/vaultPage.ts', 'src/pages/earn.ts']);
    const analysis = analyzeImpact(cleaned);
    assert.strictEqual(analysis.runType, 'TARGETED');
    assert(analysis.targetSpecs.includes('tests/e2e/no-wallet/vaultPages.spec.ts'));
    assert(analysis.targetSpecs.includes('tests/e2e/no-wallet/earnProductsPage.spec.ts'));
    console.log('  ✓ Test 8 Passed: Manual file overrides with whitespace are trimmed and matched');
  }

  // Test 9: Helper unit tests never join e2e/regression runs (they have their own workflow)
  {
    const unitOnly = analyzeImpact(['tests/unit/getActiveVault.spec.ts']);
    assert.strictEqual(unitOnly.hasTargetedTests, false);

    const withHelper = analyzeImpact([
      'tests/unit/getActiveVault.spec.ts',
      'utils/getActiveVault.ts',
    ]);
    assert.strictEqual(withHelper.runType, 'TARGETED');
    assert(withHelper.targetSpecs.every((spec) => !spec.startsWith('tests/unit/')));
    console.log('  ✓ Test 9 Passed: tests/unit/ changes are excluded from targeted e2e runs');
  }

  console.log('\n🎉 All 9 AI Change-Impact Analyzer tests passed successfully!\n');
}

runTests();
