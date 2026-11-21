import { expect } from '@playwright/test';
import type { Address } from 'viem';
import { step } from '../fixtures';
import {
  latestBlockPositionSnapshots,
  type PositionSnapshot,
  waitForIndexer,
} from '../../utils/fullStack';

/** The Ponder indexer following the fork. */
export class Indexer {
  @step
  async shouldReachBlock(blockNumber: number) {
    await waitForIndexer(blockNumber);
  }

  /**
   * The Safe's latest indexed block holds the open, priced; returns its net value in USD. Polls,
   * since pricing can land just after the block is reported indexed.
   */
  @step
  async shouldHaveOpenSnapshot(safe: Address, { timeout = 30_000 } = {}): Promise<number> {
    let open: PositionSnapshot | undefined;
    await expect
      .poll(
        async () => {
          const snapshots = await latestBlockPositionSnapshots(safe);
          open = snapshots.find((snapshot) => snapshot.action === 'open');
          return snapshots.map((snapshot) => snapshot.action);
        },
        {
          message: `Ponder's latest snapshots for Safe ${safe} should include the open`,
          timeout,
        },
      )
      .toContain('open');
    expect(open!.netValueUsd, 'the indexer should have priced the new position').toBeGreaterThan(0);
    return open!.netValueUsd!;
  }
}
