import { expect } from '@playwright/test';
import type { Address } from 'viem';
import { step } from '../fixtures';
import { latestPositionSnapshot, waitForIndexer } from '../../utils/fullStack';

/** The Ponder indexer following the fork. */
export class Indexer {
  @step
  async shouldReachBlock(blockNumber: number) {
    await waitForIndexer(blockNumber);
  }

  /** The Safe's latest snapshot is the open, priced; returns its net value in USD. */
  @step
  async shouldHaveOpenSnapshot(safe: Address): Promise<number> {
    const snapshot = await latestPositionSnapshot(safe);
    expect(snapshot, `Ponder should hold a position snapshot for Safe ${safe}`).not.toBeNull();
    expect(snapshot!.action, 'the latest snapshot should be the open').toBe('open');
    expect(
      snapshot!.netValueUsd,
      'the indexer should have priced the new position',
    ).toBeGreaterThan(0);
    return snapshot!.netValueUsd!;
  }
}
