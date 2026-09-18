export type Address = `0x${string}`;

export type Hash = `0x${string}`;

export type Protocol = 'morpho' | 'euler' | 'compoundV3' | 'aaveV3' | 'spark';

export type Network = 'ethereum' | 'base' | 'arbitrum' | 'optimism';

export type Oracle = 'morpho-oracle' | 'euler-router' | 'chainlink' | 'pyth';

export type ProductType = 'earn' | 'borrow' | 'multiply';

export type ProductTitleCase = Capitalize<ProductType>;
