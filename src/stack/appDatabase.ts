import { expect } from '@playwright/test';
import type { Address } from 'viem';
import { step } from '../fixtures';
import { termsAcceptanceRecord } from '../../utils/fullStack';

/** The app's own database (`sovereign_app` in the stack's Postgres). */
export class AppDatabase {
  /** A wallet's first Terms of Service acceptance, as `POST /api/terms/accept` stores it. */
  @step
  async shouldHaveStoredTermsAcceptance(wallet: Address) {
    const record = await termsAcceptanceRecord(wallet);

    expect(
      record.acceptances,
      'the app should store exactly one terms acceptance for this wallet',
    ).toHaveLength(1);
    const [acceptance] = record.acceptances;
    expect(acceptance.signature, 'the stored acceptance should keep the signature').toMatch(
      /^0x[0-9a-fA-F]+$/,
    );
    expect(acceptance.nonce, 'the stored acceptance should keep its nonce').toBeTruthy();

    expect(
      record.screenings.length,
      'the app should log a wallet screening for the acceptance',
    ).toBeGreaterThan(0);
    // `null` is the provider-unavailable marker; only `true` would block the wallet
    expect(
      record.screenings.map((screening) => screening.sanctioned),
      'no screening should mark this wallet as sanctioned',
    ).not.toContain(true);

    // Attribution is bound only to a visit that came through a tagged link (?ref= / utm_*)
    expect(
      record.attributions,
      'an untagged visit should not attribute the wallet to any referral or campaign',
    ).toEqual([]);
  }
}
