export type FixturesNetwork = 'Arbitrum One' | 'Base' | 'Ethereum' | 'HyperEVM' | 'OP Mainnet';

export type PositionType = 'Multiply' | 'Borrow' | 'Earn' | 'Trade';

export type Token = 'cbETH' | 'ETH' | 'USDC' | 'USDT' | 'WBTC' | 'WETH' | 'wstETH';

export type WaitToBeStableProps =
  { collateral: Token; trade?: never } | { trade: true; collateral?: never };
