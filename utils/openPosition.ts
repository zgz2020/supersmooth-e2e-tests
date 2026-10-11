import type { App } from '../src/app';

type OpenPositionParams = {
  app: App;
  depositAmount: string;
} & (
  | { positionType: 'Borrow'; borrowAmount: string }
  | { positionType: 'Multiply' | 'Earn'; borrowAmount?: never }
);

export const openPosition = async ({
  app,
  positionType,
  depositAmount,
  borrowAmount,
}: OpenPositionParams) => {
  await app.vaultPage.shouldBeVisible();

  await app.vaultPage.rightSidePanel.configurePosition.setDeposit(depositAmount);

  if (positionType === 'Borrow' && borrowAmount) {
    await app.vaultPage.rightSidePanel.configurePosition.setBorrow(borrowAmount);
  }

  await app.vaultPage.rightSidePanel.configurePosition.openPosition();
};
