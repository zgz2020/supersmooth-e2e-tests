import type { Locator, Page } from '@playwright/test';
import { expect, step } from '../fixtures';

export class TermsOfService {
  readonly page: Page;

  readonly modalLocator: Locator;

  constructor(page: Page) {
    this.page = page;
    this.modalLocator = page.getByRole('heading', { name: 'Terms of Service' });
  }

  @step
  async shouldBeVisible(args?: { timeout?: number }) {
    await expect(this.modalLocator).toBeVisible(args);
  }

  @step
  async shouldNotBeVisible(args?: { timeout?: number }) {
    await expect(this.modalLocator).not.toBeVisible(args);
  }

  @step
  async acceptTerms() {
    await this.page
      .getByRole('checkbox', { name: 'I agree to the Terms of Service and Privacy Policy' })
      .check();
  }

  @step
  async signAndAccept() {
    await this.page.getByRole('button', { name: 'Sign and Accept' }).click();
  }

  @step
  async acceptAndSign() {
    await this.acceptTerms();
    await this.signAndAccept();
  }

  /**
   * Accepts and signs, then asserts the app's server stored the acceptance for `wallet`:
   * `POST /api/terms/accept` re-derives the EIP-712 message and verifies the signature and nonce
   * server-side, so a 200 with `signed: true` proves a valid signature from that wallet.
   */
  @step
  async acceptAndSignShouldBeStoredFor(wallet: string) {
    const acceptResponse = this.page.waitForResponse(
      (response) =>
        response.url().includes('/api/terms/accept') && response.request().method() === 'POST',
    );

    await this.acceptAndSign();
    const response = await acceptResponse;

    expect(response.request().postDataJSON()).toMatchObject({
      wallet: expect.stringMatching(new RegExp(`^${wallet}$`, 'i')),
      signature: expect.stringMatching(/^0x[0-9a-fA-F]+$/),
    });
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ signed: true });
  }
}
