export type FixturesNetwork = 'Arbitrum One' | 'Base' | 'Ethereum' | 'HyperEVM' | 'OP Mainnet';

export type PositionType = 'Multiply' | 'Borrow' | 'Earn' | 'Trade';

export type Token =
  | 'cbBTC'
  | 'cbETH'
  | 'ETH'
  | 'gtUSDa'
  | 'USDC'
  | 'USDe'
  | 'USDT'
  | 'WBTC'
  | 'weETH'
  | 'WETH'
  | 'wstETH'
  | (string & {});

export type WaitToBeStableProps = (
  | { withBalance: true; collateral?: never; trade?: never }
  | { trade: true; collateral?: never; withBalance?: never }
  | { collateral: Token; trade?: never; withBalance?: never }
) & { timeout?: number };

export type Wallets =
  | 'WalletConnect'
  | 'My Wallet'
  | 'Trust Wallet'
  | 'MetaMask'
  | 'Binance Wallet'
  | 'Kriptomat'
  | 'Kriptonio'
  | 'KriptoK';
