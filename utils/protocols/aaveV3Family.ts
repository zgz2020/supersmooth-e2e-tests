/**
 * Adapter for Aave v3 and the markets built on its contracts (Aave's Lido market, Spark). Vault
 * URLs are `…/<slug>/<chain>/<pool>-<collateral>-<debt>`; everything else is read from the chain
 * through the pool's own data provider and oracle, so nothing per market is hardcoded.
 */
import { parseAbi, type Address } from 'viem';
import { erc20Balance, readContract, toUnits, tokenUnits } from '../fullStack';
import type { LendingMarket, MarketAsset, ProtocolAdapter } from './types';

const poolAbi = parseAbi(['function ADDRESSES_PROVIDER() view returns (address)']);
const addressesProviderAbi = parseAbi([
  'function getPoolDataProvider() view returns (address)',
  'function getPriceOracle() view returns (address)',
]);
const dataProviderAbi = parseAbi([
  'function getReserveTokensAddresses(address asset) view returns (address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress)',
  'function getReserveConfigurationData(address asset) view returns (uint256 decimals, uint256 ltv, uint256 liquidationThreshold, uint256 liquidationBonus, uint256 reserveFactor, bool usageAsCollateralEnabled, bool borrowingEnabled, bool stableBorrowRateEnabled, bool isActive, bool isFrozen)',
  'function getReserveCaps(address asset) view returns (uint256 borrowCap, uint256 supplyCap)',
  'function getPaused(address asset) view returns (bool isPaused)',
  'function getATokenTotalSupply(address asset) view returns (uint256)',
  'function getTotalDebt(address asset) view returns (uint256)',
]);
const oracleAbi = parseAbi(['function getAssetPrice(address asset) view returns (uint256)']);

type ReserveConfiguration = readonly [
  decimals: bigint,
  ltv: bigint,
  liquidationThreshold: bigint,
  liquidationBonus: bigint,
  reserveFactor: bigint,
  usageAsCollateralEnabled: boolean,
  borrowingEnabled: boolean,
  stableBorrowRateEnabled: boolean,
  isActive: boolean,
  isFrozen: boolean,
];

export type AaveReserve = MarketAsset & { aToken: Address; variableDebtToken: Address };

export type AaveMarket = LendingMarket & {
  pool: Address;
  dataProvider: Address;
  collateral: AaveReserve;
  debt: AaveReserve;
};

const dataProvider = <T>(market: { dataProvider: Address }, fn: string, asset: Address) =>
  readContract<T>(market.dataProvider, dataProviderAbi, fn, [asset]);

/** Pool, collateral and debt from a vault URL of this family. */
function parseVaultUrl(slug: string, url: string) {
  const match = url.match(
    new RegExp(`/${slug}/\\d+/(0x[0-9a-fA-F]{40})-(0x[0-9a-fA-F]{40})-(0x[0-9a-fA-F]{40})`),
  );
  if (!match) throw new Error(`Not a ${slug} vault URL: ${url}`);
  const [, pool, collateral, debt] = match as unknown as [string, Address, Address, Address];
  return { pool, collateral, debt };
}

async function reserve(
  market: { dataProvider: Address },
  oracle: Address,
  asset: Address,
): Promise<AaveReserve> {
  const [tokens, config, price] = await Promise.all([
    dataProvider<readonly [Address, Address, Address]>(market, 'getReserveTokensAddresses', asset),
    dataProvider<ReserveConfiguration>(market, 'getReserveConfigurationData', asset),
    readContract<bigint>(oracle, oracleAbi, 'getAssetPrice', [asset]),
  ]);
  return {
    asset,
    decimals: Number(config[0]),
    aToken: tokens[0],
    variableDebtToken: tokens[2],
    priceUsd: Number(price) / 1e8, // Aave v3 oracles quote USD with 8 decimals
  };
}

/** Status problems of one reserve: inactive, frozen, paused, or unusable for its role. */
async function reserveStatusProblems(
  market: AaveMarket,
  role: 'collateral' | 'debt',
): Promise<string[]> {
  const { asset } = market[role];
  const [config, paused] = await Promise.all([
    dataProvider<ReserveConfiguration>(market, 'getReserveConfigurationData', asset),
    dataProvider<boolean>(market, 'getPaused', asset),
  ]);
  const [, , , , , usageAsCollateral, borrowingEnabled, , isActive, isFrozen] = config;
  return [
    !isActive && `${role} reserve is not active`,
    isFrozen && `${role} reserve is frozen`,
    paused && `${role} reserve is paused`,
    role === 'collateral' && !usageAsCollateral && 'collateral is not usable as collateral',
    role === 'debt' && !borrowingEnabled && 'borrowing is disabled',
  ].filter((problem): problem is string => typeof problem === 'string');
}

/** Liquidity and cap problems for a new position of `positionUsd` on each leg. */
async function capacityProblems(market: AaveMarket, positionUsd: number): Promise<string[]> {
  const { collateral, debt } = market;
  const [[, supplyCap], [borrowCap], supplied, borrowed, available] = await Promise.all([
    dataProvider<readonly [bigint, bigint]>(market, 'getReserveCaps', collateral.asset),
    dataProvider<readonly [bigint, bigint]>(market, 'getReserveCaps', debt.asset),
    dataProvider<bigint>(market, 'getATokenTotalSupply', collateral.asset),
    dataProvider<bigint>(market, 'getTotalDebt', debt.asset),
    // Borrowable now: the debt asset held by its aToken
    erc20Balance(debt.asset, debt.aToken),
  ]);
  const usd = (amount: number, asset: AaveReserve) => Math.round(amount * asset.priceUsd);

  const problems: string[] = [];
  const availableUsd = usd(toUnits(available, debt.decimals), debt);
  if (availableUsd < positionUsd) problems.push(`only $${availableUsd} available to borrow`);
  // Caps are in whole tokens; 0 means no cap
  if (borrowCap > 0n) {
    const roomUsd = usd(Number(borrowCap) - toUnits(borrowed, debt.decimals), debt);
    if (roomUsd < positionUsd) problems.push(`borrow cap leaves $${roomUsd}`);
  }
  if (supplyCap > 0n) {
    const roomUsd = usd(Number(supplyCap) - toUnits(supplied, collateral.decimals), collateral);
    if (roomUsd < positionUsd) problems.push(`supply cap leaves $${roomUsd}`);
  }
  return problems;
}

/** An adapter for one market family deployment, by its app slug. */
export const aaveV3FamilyAdapter = (slug: string): ProtocolAdapter<AaveMarket> => ({
  slug,

  async market(url) {
    const { pool, collateral, debt } = parseVaultUrl(slug, url);
    const provider = await readContract<Address>(pool, poolAbi, 'ADDRESSES_PROVIDER');
    const [dataProviderAddress, oracle] = await Promise.all([
      readContract<Address>(provider, addressesProviderAbi, 'getPoolDataProvider'),
      readContract<Address>(provider, addressesProviderAbi, 'getPriceOracle'),
    ]);
    const base = { dataProvider: dataProviderAddress };
    return {
      url,
      pool,
      dataProvider: dataProviderAddress,
      collateral: await reserve(base, oracle, collateral),
      debt: await reserve(base, oracle, debt),
    };
  },

  async problems(market, positionUsd) {
    const statuses = await Promise.all([
      reserveStatusProblems(market, 'collateral'),
      reserveStatusProblems(market, 'debt'),
    ]);
    return [...statuses.flat(), ...(await capacityProblems(market, positionUsd))];
  },

  async position(market, safe) {
    const { collateral, debt } = market;
    const [collateralUnits, debtUnits] = await Promise.all([
      tokenUnits(collateral.aToken, safe, collateral.decimals),
      tokenUnits(debt.variableDebtToken, safe, debt.decimals),
    ]);
    return { collateral: collateralUnits, debt: debtUnits, debtUsd: debtUnits * debt.priceUsd };
  },

  // A reserve's aToken holds the market's supply of the underlying asset
  holderOf(market, asset) {
    const reserveOf = [market.collateral, market.debt].find(
      (r) => r.asset.toLowerCase() === asset.toLowerCase(),
    );
    if (!reserveOf) throw new Error(`${asset} is not part of the ${slug} market ${market.url}`);
    return reserveOf.aToken;
  },
});
