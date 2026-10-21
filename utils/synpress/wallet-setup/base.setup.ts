import { defineWalletSetup } from '@synthetixio/synpress';
import { commonMetamaskSetup, PASSWORD } from './commonWalletSetup';
import 'dotenv/config';

const walletPK = process.env.TEST_WALLET_PK as string;

if (!walletPK) {
  throw new Error('TEST_WALLET_PK environment variable is required in .env');
}

export default defineWalletSetup(PASSWORD, async (context, walletPage) => {
  const metamask = await commonMetamaskSetup({ context, walletPage });

  await metamask.importWalletFromPrivateKey(walletPK);
});
