import 'dotenv/config';
import { defineWalletSetup } from '@synthetixio/synpress';
import { commonMetamaskSetup, PASSWORD } from './commonWalletSetup';

const getWalletPK = () => {
  const rawKey = process.env.TEST_WALLET_PK || '';
  return rawKey.trim().replace(/^["']|["']$/g, '');
};

export default defineWalletSetup(PASSWORD, async (context, walletPage) => {
  const walletPK = getWalletPK();
  if (!walletPK) {
    throw new Error('TEST_WALLET_PK environment variable is missing or empty.');
  }

  const metamask = await commonMetamaskSetup({ context, walletPage });
  await metamask.importWalletFromPrivateKey(walletPK);
});
