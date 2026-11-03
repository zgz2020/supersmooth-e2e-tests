import assert from 'node:assert';
import console from 'node:console';
import { analyzeImpact, getChangedFiles } from './pr-impact-analyzer.js';

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

  console.log('\n🎉 All 8 AI Change-Impact Analyzer tests passed successfully!\n');
}

runTests();
