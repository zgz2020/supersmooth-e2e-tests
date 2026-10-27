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
  | 'wstETH';

export type WaitToBeStableProps =
  { collateral: Token; trade?: never } | { trade: true; collateral?: never };

export type Wallets =
  | 'WalletConnect'
  | 'My Wallet'
  | 'Trust Wallet'
  | 'MetaMask'
  | 'Binance Wallet'
  | 'Kriptomat'
  | 'Kriptonio'
  | 'KriptoK';
