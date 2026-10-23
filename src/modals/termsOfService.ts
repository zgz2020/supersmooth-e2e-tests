import type { Page } from '@playwright/test';
import { expect, step } from '../fixtures';

export class TermsOfService {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  @step
  async shouldBeVisible(args?: { timeout?: number }) {
    await expect(this.page.getByRole('heading', { name: 'Terms of Service' })).toBeVisible(args);
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
}
