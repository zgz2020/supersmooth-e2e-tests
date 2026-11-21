import { expect } from '@playwright/test';
import type { Address, Hex } from 'viem';
import { step } from '../fixtures';
import { safeOwners, waitForSuccessfulReceipt } from '../../utils/fullStack';
import type { Position } from '../../utils/protocols';

/** The Anvil fork: what actually happened on chain. */
export class Chain {
  /** Every transaction is mined and succeeded; returns the highest block among them. */
  @step
  async shouldHaveMinedAll(hashes: Hex[]): Promise<number> {
    expect(
      hashes.length,
      'the app should have sent at least one transaction through the wallet',
    ).toBeGreaterThan(0);
    let lastBlock = 0;
    for (const hash of hashes) {
      const receipt = await waitForSuccessfulReceipt(hash);
      lastBlock = Math.max(lastBlock, Number(receipt.blockNumber));
    }
    return lastBlock;
  }

  @step
  async shouldBeOwnedOnlyBy(safe: Address, owner: Address) {
    expect(await safeOwners(safe), `Safe ${safe} should be owned only by ${owner}`).toEqual([
      owner,
    ]);
  }

  /** The position is leveraged: more collateral than deposited, and some debt. */
  @step
  async shouldHoldLeveragedPosition(position: Position, deposited: number) {
    expect(
      position.collateral,
      `Safe should hold more collateral than the ${deposited} deposited (leverage)`,
    ).toBeGreaterThan(deposited);
    expect(position.debt, 'Safe should owe debt in the market').toBeGreaterThan(0);
  }
}
