import type { Page } from '@playwright/test';
import { expect, step } from '../../fixtures/index.js';
import type { FixturesNetwork } from '../../../utils/types/e2e/common.js';

export class ChooseNetwork {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  @step
  async shouldBeVisible() {
    await expect(this.page.getByText('Choose network')).toBeVisible();
  }

  @step
  async switchNetwork(network: FixturesNetwork) {
    await this.page.getByTestId(`w3m-network-switch-${network}`).click();
  }

  @step
  async closeModal() {
    await this.page.getByTestId('w3m-header-close').getByRole('button').click();
  }
}
