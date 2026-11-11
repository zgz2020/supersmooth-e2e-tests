/**
 * In-Page EIP-1193 & EIP-6963 Mock Provider
 *
 * Injected into the browser page context prior to script execution via `page.addInitScript`.
 * Routes read calls and transactions directly to the local Anvil fork RPC while delegating
 * cryptographic signatures (personal_sign, eth_signTypedData_v4) to Node.js Viem via
 * the Playwright binding `window.__playwright_sign`.
 */

export interface EIP1193Config {
  chainId: number;
  rpcUrl: string;
  accounts: string[];
  initiallyConnected?: boolean;
}

export function createEIP1193Script(config: EIP1193Config): string {
  return `(function() {
  const config = ${JSON.stringify(config)};
  const listeners = {};
  let isConnected = config.initiallyConnected !== false;
  let rejectNext = false;

  // Wallet state survives reloads/navigation within the tab, like a real wallet extension.
  // Each Playwright test gets a fresh browser context, so nothing leaks between tests.
  const STATE_KEY = '__eip1193_mock_state';
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(STATE_KEY) || 'null');
    if (saved) {
      if (Array.isArray(saved.accounts)) config.accounts = saved.accounts;
      if (typeof saved.chainId === 'number') config.chainId = saved.chainId;
      if (typeof saved.isConnected === 'boolean') isConnected = saved.isConnected;
    }
  } catch (e) {
    // sessionStorage unavailable (e.g. sandboxed iframe): fall back to in-memory state
  }
  const persist = () => {
    try {
      window.sessionStorage.setItem(
        STATE_KEY,
        JSON.stringify({ accounts: config.accounts, chainId: config.chainId, isConnected }),
      );
    } catch (e) {
      // ignore
    }
  };

  const applyChainId = (rawChainId) => {
    const numChainId = typeof rawChainId === 'string' ? parseInt(rawChainId, 16) : Number(rawChainId);
    config.chainId = numChainId;
    const hexChainId = '0x' + numChainId.toString(16);
    provider.chainId = hexChainId;
    provider.networkVersion = String(numChainId);
    persist();
    provider.emit('chainChanged', hexChainId);
  };

  window.__eip1193Control = {
    setConnected: (val) => {
      isConnected = !!val;
      provider.selectedAddress = isConnected ? (config.accounts[0] || null) : null;
      persist();
      if (isConnected) {
        provider.emit('connect', { chainId: provider.chainId });
        provider.emit('accountsChanged', config.accounts);
      } else {
        provider.emit('accountsChanged', []);
        provider.emit('disconnect', { code: 4900, message: 'Provider disconnected' });
      }
    },
    setRejectNext: (val) => { rejectNext = !!val; },
    setAccounts: (newAccounts) => {
      config.accounts = Array.isArray(newAccounts) ? newAccounts : [newAccounts];
      provider.selectedAddress = isConnected ? (config.accounts[0] || null) : null;
      persist();
      provider.emit('accountsChanged', isConnected ? config.accounts : []);
    },
    setChainId: (newChainId) => applyChainId(newChainId),
  };

  const provider = {
    isMetaMask: true,
    chainId: '0x' + config.chainId.toString(16),
    networkVersion: String(config.chainId),
    selectedAddress: isConnected ? (config.accounts[0] || null) : null,
    isConnected: () => isConnected,

    on: (event, handler) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
      return provider;
    },

    addListener: (event, handler) => provider.on(event, handler),

    removeListener: (event, handler) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((h) => h !== handler);
      }
      return provider;
    },

    removeAllListeners: (event) => {
      if (event) {
        delete listeners[event];
      } else {
        Object.keys(listeners).forEach((k) => delete listeners[k]);
      }
      return provider;
    },

    emit: (event, ...args) => {
      if (listeners[event]) {
        listeners[event].forEach((handler) => {
          try {
            handler(...args);
          } catch (err) {
            console.error('[EIP1193 Mock] Error in event listener for ' + event, err);
          }
        });
      }
      return true;
    },

    request: async ({ method, params = [] }) => {
      const isUserApprovalMethod =
        method === 'eth_sendTransaction' ||
        method === 'personal_sign' ||
        method === 'eth_signTypedData_v4' ||
        method === 'eth_signTypedData_v3' ||
        method === 'eth_signTypedData' ||
        method === 'eth_requestAccounts';

      if (rejectNext && isUserApprovalMethod) {
        rejectNext = false;
        const err = new Error('User rejected the request');
        err.code = 4001;
        throw err;
      }

      if (method === 'eth_accounts') {
        return isConnected ? config.accounts : [];
      }

      if (method === 'eth_requestAccounts') {
        isConnected = true;
        provider.selectedAddress = config.accounts[0] || null;
        persist();
        provider.emit('connect', { chainId: provider.chainId });
        provider.emit('accountsChanged', config.accounts);
        return config.accounts;
      }

      if (method === 'eth_chainId') {
        return '0x' + config.chainId.toString(16);
      }

      if (method === 'net_version') {
        return String(config.chainId);
      }

      if (method === 'wallet_switchEthereumChain') {
        const rawChain = Array.isArray(params) && params[0] ? params[0].chainId : params;
        applyChainId(rawChain);
        return null;
      }

      // Delegate cryptographic signatures directly to Node.js Viem via exposed binding
      if (
        method === 'personal_sign' ||
        method === 'eth_signTypedData_v4' ||
        method === 'eth_signTypedData_v3' ||
        method === 'eth_signTypedData'
      ) {
        if (typeof window.__playwright_sign === 'function') {
          return await window.__playwright_sign(method, params);
        }
        throw new Error('[EIP1193 Mock] Signing bridge window.__playwright_sign unavailable');
      }

      // Forward read-only queries and write transactions directly to local Anvil fork RPC
      const payload = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        jsonrpc: '2.0',
        method,
        params,
      };

      const res = await window.fetch(config.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.error) {
        const error = new Error(json.error.message || 'RPC Error');
        Object.assign(error, json.error);
        throw error;
      }

      return json.result;
    },
  };

  window.ethereum = provider;
  window.dispatchEvent(new Event('ethereum#initialized'));

  // Announce EIP-6963 provider so modern Web3 connectors (Wagmi / RainbowKit / Web3Modal)
  // automatically discover the mock wallet without relying solely on legacy window.ethereum
  const announceDetails = Object.freeze({
    info: {
      uuid: 'f2d8b4b0-379e-4e33-9f89-8d62dc73be74',
      name: 'MetaMask',
      icon: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="%23E4761B"/></svg>',
      rdns: 'io.metamask',
    },
    provider,
  });

  const announce = () => {
    window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: announceDetails }));
  };

  window.addEventListener('eip6963:requestProvider', announce);
  announce();
})();`;
}
