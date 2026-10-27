import { test } from '../../../src/fixtures';
import type { Token } from '../../../utils/types/e2e/common';

const vaults: { positionType: string; url: string; collateral: Token }[] = [
  {
    positionType: 'Multiply',
    url: '/products/multiply/aaveV3/1/0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2-0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf-0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    collateral: 'cbBTC',
  },
  {
    positionType: 'Borrow',
    url: '/products/borrow/morpho/4663/0xc845da65a020ddca5f132efa8fea79676d8edfdea504226a4c01e7a9e34cddd6',
    collateral: 'USDe',
  },
  {
    positionType: 'Earn - Passive Strategy',
    url: '/products/earn/lido/8453/0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452',
    collateral: 'wstETH',
  },
  {
    positionType: 'Earn - Automated Strategy',
    url: '/products/earn/gauntlet/42161/0x000000001DC8bd45d7E7829fb1c969cbe4D0D1eC',
    collateral: 'gtUSDa',
  },
  {
    positionType: 'Earn - Yield Loops',
    url: '/products/yield-loop/fluid/1/0xeAEf563015634a9d0EE6CF1357A3b205C35e028D-0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee-0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0',
    collateral: 'weETH',
  },
];

test.describe('Vault pages', () => {
  vaults.forEach(({ positionType, url, collateral }) => {
    test(`it should request to connect wallet when trying to open a ${positionType} position`, async ({
      app,
    }) => {
      await app.vaultPage.openPage(url, { collateral });

      await app.vaultPage.rightSidePanel.configurePosition.connectWallet();
      await app.modals.connectWallet.shouldBeVisible();
    });
  });
});
