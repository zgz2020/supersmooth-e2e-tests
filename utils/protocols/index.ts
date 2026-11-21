import { test, type APIRequestContext } from '@playwright/test';
import { getActiveVault, type ActiveVaultResult } from '../getActiveVault';
import { aaveV3FamilyAdapter } from './aaveV3Family';
import type { LendingMarket, OpenPositionScenario } from './types';

/**
 * Protocols the full-stack suite can open positions on. Add an adapter here to cover a new
 * protocol; its product table must also be filled by the stack (`E2E_PRODUCT_TABLE_PROTOCOLS`).
 */
export const PROTOCOLS = {
  aaveV3: aaveV3FamilyAdapter('aaveV3'),
  aaveV3Lido: aaveV3FamilyAdapter('aaveV3Lido'),
  spark: aaveV3FamilyAdapter('spark'),
};

/**
 * The most liquid Multiply vault for the scenario that can take a position of `minRoomUsd` on
 * each leg right now. Candidates come from the app (`getActiveVault`, filtered by network,
 * collateral and protocol); each is checked on chain by the protocol's adapter, and a rejected one
 * moves on to the next.
 *
 * Records the choice in the report (`vault` annotation, plus `vault skipped` with the reasons for
 * each rejected candidate), so failures stay comparable between runs.
 */
export async function pickOpenableVault(
  request: APIRequestContext,
  { protocol, network, collateral }: OpenPositionScenario,
  { minRoomUsd }: { minRoomUsd: number },
): Promise<{ vault: ActiveVaultResult; market: LendingMarket }> {
  const rejected: string[] = [];

  const canOpen = async (candidate: ActiveVaultResult) => {
    try {
      const market = await protocol.market(candidate.url);
      const problems =
        market.collateral.asset.toLowerCase() === collateral.address.toLowerCase()
          ? await protocol.problems(market, minRoomUsd)
          : [`collateral is not ${collateral.symbol}`];
      if (problems.length > 0) rejected.push(`${candidate.url}: ${problems.join(', ')}`);
      return problems.length === 0;
    } catch (error) {
      rejected.push(`${candidate.url}: ${(error as Error).message}`);
      return false;
    }
  };

  const vault = await getActiveVault(request, 'multiply', {
    network: network.name,
    collateral: collateral.symbol,
    protocols: protocol.slug,
    accept: canOpen,
  }).catch((error: Error) => {
    throw new Error(`${error.message}. Rejected: ${rejected.join('; ') || 'none'}`);
  });

  const { annotations } = test.info();
  annotations.push({ type: 'vault', description: `${vault.title} ${vault.url}` });
  for (const reason of rejected) annotations.push({ type: 'vault skipped', description: reason });

  return { vault, market: await protocol.market(vault.url) };
}

export type { LendingMarket, OpenPositionScenario, Position, ProtocolAdapter } from './types';
