/**
 * scripts/qa-agent/defi-fee-orchestrator.test.js
 *
 * Comprehensive unit test suite for the DeFi Fee Verification Engine & Orchestrator.
 * Validates notional calculations, fee tier resolution, boundary invariants, and verification logic.
 */

import assert from 'node:assert';
import console from 'node:console';
import process from 'node:process';
import {
  calculateMultiplyNotional,
  calculatePositionSwapFee,
  resolveSwapFeeTier,
  verifyFeeTier,
} from './fee-engine.js';
import { DeFiFeeOrchestrator } from './defi-fee-orchestrator.js';

function runTests() {
  console.log('🧪 Running DeFi Fee Verification Engine Unit Tests...\n');

  // --- SUITE 1: Multiply Notional Calculations ---
  console.log('📦 Suite 1: Multiply Notional Calculations');

  // Test 1: Standard 2.0x Multiply
  {
    const res = calculateMultiplyNotional({
      depositAmount: 10,
      depositTokenPriceUsd: 2000,
      multiple: 2.0,
    });
    assert.strictEqual(res.depositUsd, 20_000);
    assert.strictEqual(res.totalPositionSizeUsd, 40_000);
    assert.strictEqual(res.borrowAmountUsd, 20_000);
    assert.strictEqual(res.swapNotionalUsd, 20_000);
    console.log(
      '  ✓ Test 1 Passed: 2.0x Multiply correctly derives $20k deposit -> $20k swap notional',
    );
  }

  // Test 2: High Leverage 4.0x Multiply
  {
    const res = calculateMultiplyNotional({
      depositAmount: 50,
      depositTokenPriceUsd: 2000,
      multiple: 4.0,
    });
    assert.strictEqual(res.depositUsd, 100_000);
    assert.strictEqual(res.totalPositionSizeUsd, 400_000);
    assert.strictEqual(res.borrowAmountUsd, 300_000);
    assert.strictEqual(res.swapNotionalUsd, 300_000);
    console.log(
      '  ✓ Test 2 Passed: 4.0x Multiply correctly derives $100k deposit -> $300k swap notional',
    );
  }

  // Test 3: Validation on non-positive deposit or multiple < 1.0x
  {
    assert.throws(() =>
      calculateMultiplyNotional({ depositAmount: 0, depositTokenPriceUsd: 100, multiple: 2.0 }),
    );
    assert.throws(() =>
      calculateMultiplyNotional({ depositAmount: 10, depositTokenPriceUsd: 100, multiple: 0.5 }),
    );
    console.log('  ✓ Test 3 Passed: Throws error on invalid deposit or leverage multiples');
  }

  // --- SUITE 2: Swap Fee Tier Resolution & Exact Boundaries ---
  console.log('\n📦 Suite 2: Swap Fee Tier Resolution & Exact Boundaries');

  // Test 4: Tier 1 (< $100,000)
  {
    const t0 = resolveSwapFeeTier(0);
    const tMid = resolveSwapFeeTier(50_000);
    const tEdge = resolveSwapFeeTier(99_999.99);
    assert.strictEqual(t0.bps, 30);
    assert.strictEqual(tMid.bps, 30);
    assert.strictEqual(tEdge.bps, 30);
    console.log('  ✓ Test 4 Passed: Tier 1 resolves 30 bps for $0 to $99,999.99');
  }

  // Test 5: Tier 2 ($100,000 to $1,000,000)
  {
    const tLow = resolveSwapFeeTier(100_000.0);
    const tMid = resolveSwapFeeTier(500_000);
    const tHigh = resolveSwapFeeTier(999_999.99);
    assert.strictEqual(tLow.bps, 25);
    assert.strictEqual(tMid.bps, 25);
    assert.strictEqual(tHigh.bps, 25);
    console.log('  ✓ Test 5 Passed: Tier 2 resolves 25 bps for $100,000.00 to $999,999.99');
  }

  // Test 6: Tier 3 ($1,000,000 to $10,000,000)
  {
    const tLow = resolveSwapFeeTier(1_000_000.0);
    const tMid = resolveSwapFeeTier(5_000_000);
    const tHigh = resolveSwapFeeTier(9_999_999.99);
    assert.strictEqual(tLow.bps, 15);
    assert.strictEqual(tMid.bps, 15);
    assert.strictEqual(tHigh.bps, 15);
    console.log('  ✓ Test 6 Passed: Tier 3 resolves 15 bps for $1,000,000.00 to $9,999,999.99');
  }

  // Test 7: Tier 4 (> $10,000,000)
  {
    const tLow = resolveSwapFeeTier(10_000_000.0);
    const tMid = resolveSwapFeeTier(25_000_000);
    const tMega = resolveSwapFeeTier(100_000_000);
    assert.strictEqual(tLow.bps, 5);
    assert.strictEqual(tMid.bps, 5);
    assert.strictEqual(tMega.bps, 5);
    console.log('  ✓ Test 7 Passed: Tier 4 resolves 5 bps for $10,000,000.00 and above');
  }

  // Test 8: Negative notional validation
  {
    assert.throws(() => resolveSwapFeeTier(-1));
    console.log('  ✓ Test 8 Passed: Throws error on negative notional');
  }

  // --- SUITE 3: Fee Calculations & Precision Verification ---
  console.log('\n📦 Suite 3: Fee Calculations & Precision Verification');

  // Test 9: calculatePositionSwapFee dollar amounts
  {
    const calc1 = calculatePositionSwapFee({ notionalUsd: 50_000 });
    assert.strictEqual(calc1.bps, 30);
    assert.strictEqual(calc1.expectedFeeUsd, 150); // $50,000 * 0.003 = $150

    const calc2 = calculatePositionSwapFee({ notionalUsd: 200_000 });
    assert.strictEqual(calc2.bps, 25);
    assert.strictEqual(calc2.expectedFeeUsd, 500); // $200,000 * 0.0025 = $500

    const calc3 = calculatePositionSwapFee({ notionalUsd: 2_000_000 });
    assert.strictEqual(calc3.bps, 15);
    assert.strictEqual(calc3.expectedFeeUsd, 3_000); // $2,000,000 * 0.0015 = $3,000

    const calc4 = calculatePositionSwapFee({ notionalUsd: 20_000_000 });
    assert.strictEqual(calc4.bps, 5);
    assert.strictEqual(calc4.expectedFeeUsd, 10_000); // $20,000,000 * 0.0005 = $10,000

    console.log('  ✓ Test 9 Passed: Exact fee USD calculations match expected tier formulas');
  }

  // Test 10: verifyFeeTier detects compliance and violations
  {
    // Exact compliance
    const validRes = verifyFeeTier({ notionalUsd: 200_000, actualFeeUsd: 500 });
    assert.strictEqual(validRes.isValid, true);
    assert.strictEqual(validRes.expectedBps, 25);
    assert.strictEqual(validRes.deltaBps, 0);

    // Violation: charged 30 bps ($600) instead of 25 bps ($500)
    const invalidRes = verifyFeeTier({ notionalUsd: 200_000, actualFeeUsd: 600 });
    assert.strictEqual(invalidRes.isValid, false);
    assert.strictEqual(invalidRes.expectedBps, 25);
    assert.strictEqual(invalidRes.actualBps, 30);
    assert.strictEqual(invalidRes.deltaBps, 5);
    assert.match(invalidRes.reason, /Fee MISMATCH/);

    console.log(
      '  ✓ Test 10 Passed: verifyFeeTier accurately validates compliance and flags violations',
    );
  }

  // Test 11: calculatePositionSwapFee normalizes yield-loop and handles zero notional
  {
    const yl = calculatePositionSwapFee({ notionalUsd: 100_000, category: 'yield-loop' });
    assert.strictEqual(yl.category, 'yieldLoop');
    assert.strictEqual(yl.bps, 25);

    const zeroRes = verifyFeeTier({ notionalUsd: 0, actualFeeUsd: 0 });
    assert.strictEqual(zeroRes.isValid, true);
    assert.strictEqual(zeroRes.deltaBps, 0);

    console.log(
      '  ✓ Test 11 Passed: calculatePositionSwapFee normalizes yield-loop and handles zero notional',
    );
  }

  // --- SUITE 4: DeFiFeeOrchestrator Execution ---
  console.log('\n📦 Suite 4: DeFiFeeOrchestrator Execution');

  // Test 12: Orchestrator audits all tiers successfully
  {
    const orchestrator = new DeFiFeeOrchestrator({ report: false, json: false });
    return orchestrator.runAudit().then((audit) => {
      assert.strictEqual(audit.passed, true);
      assert.strictEqual(audit.scenarioResults.length, 7);
      assert.strictEqual(audit.boundaryResults.length, 6);
      console.log('  ✓ Test 12 Passed: Full audit run passes 7 scenarios and 6 boundaries');

      // Test 13: Orchestrator tier filtering
      const tier2Orchestrator = new DeFiFeeOrchestrator({ tier: '2', report: false });
      return tier2Orchestrator.runAudit().then((auditTier2) => {
        assert.strictEqual(auditTier2.passed, true);
        assert.strictEqual(auditTier2.scenarioResults.length, 2);
        assert(auditTier2.scenarioResults.every((s) => s.expectedBps === 25));
        console.log(
          '  ✓ Test 13 Passed: Filtered orchestrator runs only targeted Tier 2 scenarios',
        );

        console.log('\n🎉 ALL 13 UNIT TESTS PASSED SUCCESSFULLY!\n');
      });
    });
  }
}

runTests().catch((err) => {
  console.error('\n✖ Unit test failed:', err);
  process.exit(1);
});
