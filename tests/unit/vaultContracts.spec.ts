import { test, expect } from '@playwright/test';
import { poolReserveMarket, vaultContractAddresses } from '../../utils/vaultContracts';

/** Unit tests for the contracts and pool markets a vault page URL names (no network). */
const POOL = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2';
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

test.describe('vaultContractAddresses', () => {
  test('a lending market URL names its pool, collateral and debt token', () => {
    expect(vaultContractAddresses(`/products/multiply/aaveV3/1/${POOL}-${WETH}-${USDC}`)).toEqual([
      POOL,
      WETH,
      USDC,
    ]);
  });

  test('an Earn URL names its vault', () => {
    const vault = '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0';
    expect(vaultContractAddresses(`/products/earn/lido/1/${vault}`)).toEqual([vault]);
  });

  test('works on full URLs, with a trailing slash, query or hash', () => {
    const url = `https://staging.supersmooth.fi/products/borrow/aaveV3/1/${POOL}-${WETH}-${USDC}`;
    expect(vaultContractAddresses(`${url}/`)).toEqual([POOL, WETH, USDC]);
    expect(vaultContractAddresses(`${url}?tab=manage#top`)).toEqual([POOL, WETH, USDC]);
  });

  test('a 32-byte market id (Morpho) is not an address, so nothing is checked', () => {
    const marketId = '0x8793cf302b8ffd655ab97bd1c695dbd967807e8367a65cb2f4edaf1380ba1bda';
    expect(vaultContractAddresses(`/products/multiply/morpho/8453/${marketId}`)).toEqual([]);
  });

  test('leaves out native-token placeholders', () => {
    const native = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    const zero = '0x0000000000000000000000000000000000000000';
    expect(vaultContractAddresses(`/products/borrow/x/1/${POOL}-${native}-${zero}`)).toEqual([
      POOL,
    ]);
  });

  test('ignores path segments other than the last one', () => {
    expect(vaultContractAddresses(`/products/${WETH}/aaveV3/1/not-an-address`)).toEqual([]);
  });
});

test.describe('poolReserveMarket', () => {
  test('an Aave V3 market is the pool plus its collateral and debt token', () => {
    expect(poolReserveMarket(`/products/multiply/aaveV3/1/${POOL}-${WETH}-${USDC}`)).toEqual({
      pool: POOL,
      tokens: [WETH, USDC],
    });
  });

  test('covers the Aave V3 forks, whatever the slug case, on full URLs', () => {
    const url = `https://staging.supersmooth.fi/products/borrow/SPARK/1/${POOL}-${WETH}-${USDC}/`;
    expect(poolReserveMarket(url)?.pool).toBe(POOL);
    expect(poolReserveMarket(`/products/earn/aaveV3Lido/1/${POOL}-${WETH}-${USDC}`)?.pool).toBe(
      POOL,
    );
  });

  test('other protocols are not pool markets', () => {
    expect(poolReserveMarket(`/products/multiply/compound/1/${POOL}-${WETH}-${USDC}`)).toBeNull();
    const marketId = '0x8793cf302b8ffd655ab97bd1c695dbd967807e8367a65cb2f4edaf1380ba1bda';
    expect(poolReserveMarket(`/products/multiply/morpho/8453/${marketId}`)).toBeNull();
  });

  test('a market id that is not three addresses is not a pool market', () => {
    expect(poolReserveMarket(`/products/multiply/aaveV3/1/${POOL}-${WETH}`)).toBeNull();
    expect(poolReserveMarket(`/products/multiply/aaveV3/1/${POOL}-${WETH}-usdc`)).toBeNull();
    expect(poolReserveMarket('/vaults/aaveV3')).toBeNull();
  });
});
