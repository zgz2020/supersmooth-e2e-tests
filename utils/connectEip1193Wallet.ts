import type { App } from '../src/app';

/**
 * Connects the in-page EIP-1193 mock wallet to the dApp.
 * Unlike extension automation (Synpress), this resolves immediately in-page
 * without spawning popup windows or requiring OS-level window focus.
 */
export const connectEip1193Wallet = async (app: App): Promise<void> => {
  await app.header.connectWallet();
  await app.modals.connectWallet.connectMetaMask();
  await app.header.shouldHaveShortAddress();
  await app.modals.connectWallet.closeModal();
};
