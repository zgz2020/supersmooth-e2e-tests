import assert from 'node:assert';
import console from 'node:console';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { SnapshotRegistry } from '../../scripts/qa-agent/heal-agent.js';
import { evaluateRetention } from '../../scripts/qa-agent/cleanup-branches.js';

function runTests() {
  console.log('🧪 Running Batch Safety & Branch Retention Unit Tests...\n');

  // --- SUITE 1: SnapshotRegistry (Batch Safety) ---
  console.log('📦 Suite 1: SnapshotRegistry Batch Safety');

  const tmpTestDir = path.resolve(process.cwd(), '.temp', 'test-snapshots');
  if (!fs.existsSync(tmpTestDir)) {
    fs.mkdirSync(tmpTestDir, { recursive: true });
  }

  const testFileA = path.join(tmpTestDir, 'pageObjectA.ts');
  const initialContent = 'export class PageA { locator = "old_selector"; }';
  fs.writeFileSync(testFileA, initialContent, 'utf-8');

  const registry = new SnapshotRegistry();

  // Test 1: File registration records base snapshot
  {
    registry.registerFile(testFileA);
    assert.strictEqual(registry.getCurrentContent(testFileA), initialContent);
    assert.strictEqual(registry.baseSnapshots.get(testFileA), initialContent);
    console.log('  ✓ Test 1 Passed: registerFile captures initial base content');
  }

  // Test 2: Committing stage 1 preserves verified fix
  const stage1Content = 'export class PageA { locator = "verified_selector_1"; }';
  {
    registry.commitStage(testFileA, stage1Content);
    assert.strictEqual(registry.getCurrentContent(testFileA), stage1Content);
    console.log('  ✓ Test 2 Passed: commitStage updates active staged content');
  }

  // Test 3: Failure on stage 2 rolls back to stage 1 (does NOT revert to initial base!)
  const stage2BadContent = 'export class PageA { locator = "broken_selector_2"; }';
  {
    const backup = registry.createDiskBackup(testFileA);
    fs.writeFileSync(testFileA, stage2BadContent, 'utf-8');

    // Simulate verification failure on stage 2 -> rollbackToLastStage
    registry.rollbackToLastStage(testFileA, backup);

    const onDiskContent = fs.readFileSync(testFileA, 'utf-8');
    assert.strictEqual(onDiskContent, stage1Content);
    assert.strictEqual(fs.existsSync(backup), false);
    console.log(
      '  ✓ Test 3 Passed: rollbackToLastStage restores stage 1 without reverting to base',
    );
  }

  // Test 4: Global rollbackAll restores initial base content
  {
    registry.rollbackAll();
    const restored = fs.readFileSync(testFileA, 'utf-8');
    assert.strictEqual(restored, initialContent);
    console.log('  ✓ Test 4 Passed: rollbackAll safely restores original base snapshot');
  }

  // Cleanup test files
  if (fs.existsSync(testFileA)) fs.unlinkSync(testFileA);

  // --- SUITE 2: Branch Retention Evaluation ---
  console.log('\n📦 Suite 2: Branch Retention Policy Evaluation');

  const mockBranches = [
    {
      ref: 'origin/ai-heal/merged-fix',
      branchName: 'ai-heal/merged-fix',
      date: '2026-11-01',
      ageDays: 2,
      isMerged: true,
    },
    {
      ref: 'origin/ai-heal/active-recent',
      branchName: 'ai-heal/active-recent',
      date: '2026-11-02',
      ageDays: 5,
      isMerged: false,
    },
    {
      ref: 'origin/ai-heal/stale-old',
      branchName: 'ai-heal/stale-old',
      date: '2026-09-01',
      ageDays: 45,
      isMerged: false,
    },
  ];

  // Test 5: Default 30-day policy prunes merged and stale (>30d) branches
  {
    const evaluation = evaluateRetention(mockBranches, { days: 30 });
    assert.strictEqual(evaluation.toDelete.length, 2);
    assert.strictEqual(evaluation.toRetain.length, 1);

    const deletedNames = evaluation.toDelete.map((b) => b.branchName);
    assert(deletedNames.includes('ai-heal/merged-fix'));
    assert(deletedNames.includes('ai-heal/stale-old'));

    const retainedNames = evaluation.toRetain.map((b) => b.branchName);
    assert(retainedNames.includes('ai-heal/active-recent'));
    console.log('  ✓ Test 5 Passed: Default 30-day policy correctly partitions branches');
  }

  // Test 6: Custom 60-day policy retains active unmerged branch older than 30 days
  {
    const evaluation = evaluateRetention(mockBranches, { days: 60 });
    assert.strictEqual(evaluation.toDelete.length, 1); // only merged-fix
    assert.strictEqual(evaluation.toRetain.length, 2); // active-recent and stale-old (45d < 60d)
    console.log('  ✓ Test 6 Passed: Custom retention window strictly respected');
  }

  console.log('\n🎉 All 6 Batch Safety & Branch Retention tests passed successfully!\n');
}

runTests();
