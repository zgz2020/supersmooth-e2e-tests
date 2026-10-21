import type { Page } from '@playwright/test';
import { expect, step } from '../fixtures';
import { heroRenderTimeout } from '../../utils/constants/timeouts';

export class LandingPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  @step
  async open() {
    await this.page.goto('/');
  }

  @step
  async shouldBeOpened() {
    await expect(
      this.page.getByRole('heading', { name: 'Onchain finance, all in one app.' }),
    ).toBeVisible({ timeout: heroRenderTimeout });
  }

  @step
  async shouldHaveSecuritySectionInViewport() {
    const securitySection = this.page.getByRole('heading', {
      name: '100% Self-Custodial, powered by Safe',
      exact: true,
    });
    await expect(securitySection).toBeInViewport({ ratio: 0.5 });
  }
}
