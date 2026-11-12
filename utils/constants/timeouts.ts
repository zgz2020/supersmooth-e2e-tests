/**
 * Environment-aware timeout profiles (milliseconds).
 *
 * Every value is scaled by `TIMEOUT_MULTIPLIER` (default: 1.5 in CI, 1.0 locally).
 * Per-profile test/expect timeouts can be overridden before scaling with:
 *   TEST_TIMEOUT_API, EXPECT_TIMEOUT_API,
 *   TEST_TIMEOUT_STAGING, EXPECT_TIMEOUT_STAGING,
 *   TEST_TIMEOUT_WITH_WALLET, EXPECT_TIMEOUT_WITH_WALLET,
 *   TEST_TIMEOUT_ANVIL, EXPECT_TIMEOUT_ANVIL
 * Navigation, action and fixture timeouts are not env-overridable; use TIMEOUT_MULTIPLIER.
 */

const isCI = !!process.env.CI;
const envMultiplier = Number(process.env.TIMEOUT_MULTIPLIER);
const multiplier = !isNaN(envMultiplier) && envMultiplier > 0 ? envMultiplier : isCI ? 1.5 : 1.0;

/** Scaled timeout, using the env override when it is a positive number */
const scaled = (fallbackMs: number, envKey?: string): number => {
  const override = envKey ? Number(process.env[envKey]) : NaN;
  return (override > 0 ? override : fallbackMs) * multiplier;
};

export const TIMEOUTS = {
  // Fast HTTP API testing
  api: {
    test: scaled(30_000, 'TEST_TIMEOUT_API'),
    expect: scaled(5_000, 'EXPECT_TIMEOUT_API'),
  },
  // Staging UI without wallet (static CDN delivery)
  staging: {
    test: scaled(60_000, 'TEST_TIMEOUT_STAGING'),
    expect: scaled(10_000, 'EXPECT_TIMEOUT_STAGING'),
    navigation: scaled(30_000),
    action: scaled(10_000),
  },
  // Staging with wallet (Synpress + MetaMask setup overhead)
  withWallet: {
    test: scaled(90_000, 'TEST_TIMEOUT_WITH_WALLET'),
    expect: scaled(15_000, 'EXPECT_TIMEOUT_WITH_WALLET'),
    navigation: scaled(45_000),
    action: scaled(15_000),
    fixture: scaled(75_000),
  },
  // Local Anvil fork (cold Next.js compilation on localhost + local RPC polling + balance hydration)
  anvil: {
    test: scaled(120_000, 'TEST_TIMEOUT_ANVIL'),
    expect: scaled(30_000, 'EXPECT_TIMEOUT_ANVIL'),
    navigation: scaled(60_000),
    action: scaled(20_000),
    fixture: scaled(90_000),
  },
};

// Base for explicit waits multiplied at call sites (e.g. `defaultExpectTimeout * 3`).
// Kept at its original 5s so existing waits do not silently double.
export const defaultExpectTimeout: number = scaled(5_000);
export const heroRenderTimeout: number = scaled(15_000);
