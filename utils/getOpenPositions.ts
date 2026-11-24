import type { APIRequestContext } from '@playwright/test';
import type { Address } from './types/api/common';
import { indexerGraphqlUrl, indexerUrlVariable } from './constants/urls';

/** The indexer's maximum page size: a query that fills it may have left rows out. */
const PAGE_LIMIT = 1000;

/** Product and protocol names as the indexer stores them (SDK `Category` / `Protocol` enums). */
export type IndexerProduct = 'Borrow' | 'Multiply' | 'Earn';
export type IndexerProtocol =
  'AaveV3' | 'AaveV3Lido' | 'CompoundV3' | 'EulerV2' | 'Fluid' | 'Lido' | 'Morpho' | 'Spark';

/** A Supersmooth position that is open right now, held by any wallet. */
export interface OpenPosition {
  owner: Address;
  /** The Safe holding the position: the last segment of its page URL */
  safe: Address;
  product: IndexerProduct;
  protocol: IndexerProtocol;
  chainId: number;
  /**
   * USD net value (supplied value for Earn) the indexer recorded at the position's last on-chain
   * event, so possibly days old; null when it could not value the position. Only used to rank.
   */
  lastNetValueUsd: number | null;
}

interface IndexerPosition {
  id: string;
  safeId: string;
  product: IndexerProduct;
  protocol: IndexerProtocol;
  chainId: number;
  owner: Address;
}

interface IndexerSnapshot {
  positionId: string;
  netValueUsd: number | null;
  suppliedUsd: number | null;
}

/**
 * Lists open Supersmooth positions of any wallet, largest first (by the net value the indexer
 * recorded at each one's last event; unvalued ones last), from the indexer's public GraphQL API
 * (the same data the Portfolio page is built from). Nothing is hard-coded, so a closed position
 * simply drops out of the list.
 */
export async function getOpenPositions(
  request: APIRequestContext,
  filter: { product?: IndexerProduct; protocol?: IndexerProtocol } = {},
): Promise<OpenPosition[]> {
  // Every open position (a few dozen), filtered here: an absent filter means any
  const { positions: allOpen } = await queryIndexer<{ positions: { items: IndexerPosition[] } }>(
    request,
    `{
      positions(where: { isActive: true }, limit: ${PAGE_LIMIT}) {
        items { id safeId product protocol chainId owner }
      }
    }`,
    {},
  );
  assertFullList('positions', allOpen.items);
  const positions = {
    items: allOpen.items.filter(
      (p) =>
        (!filter.product || p.product === filter.product) &&
        (!filter.protocol || p.protocol === filter.protocol),
    ),
  };
  if (positions.items.length === 0) return [];

  // A position only has the Safe's indexer id; its page URL needs the Safe address
  const { safes } = await queryIndexer<{ safes: { items: { id: string; address: Address }[] } }>(
    request,
    `query ($ids: [String!]) {
      safes(where: { id_in: $ids }, limit: ${PAGE_LIMIT}) { items { id address } }
    }`,
    { ids: [...new Set(positions.items.map((p) => p.safeId))] },
  );
  assertFullList('safes', safes.items);
  const safeAddress = new Map(safes.items.map((s) => [s.id, s.address]));

  // Newest snapshot first, so the first one seen per position is its latest value
  const { positionSnapshots } = await queryIndexer<{
    positionSnapshots: { items: IndexerSnapshot[] };
  }>(
    request,
    `query ($ids: [String!]) {
      positionSnapshots(
        where: { positionId_in: $ids }, orderBy: "blockTimestamp", orderDirection: "desc", limit: ${PAGE_LIMIT}
      ) { items { positionId netValueUsd suppliedUsd } }
    }`,
    { ids: positions.items.map((p) => p.id) },
  );
  assertFullList('positionSnapshots', positionSnapshots.items);
  const lastNetValueUsd = new Map<string, number | null>();
  for (const { positionId, netValueUsd, suppliedUsd } of positionSnapshots.items) {
    if (!lastNetValueUsd.has(positionId)) {
      lastNetValueUsd.set(positionId, netValueUsd ?? suppliedUsd);
    }
  }

  return positions.items
    .flatMap(({ id, safeId, ...position }) => {
      const safe = safeAddress.get(safeId);
      return safe ? [{ ...position, safe, lastNetValueUsd: lastNetValueUsd.get(id) ?? null }] : [];
    })
    .sort((a, b) => rank(b) - rank(a));
}

/** Sort key: the last recorded net value, with unvalued positions after every valued one. */
function rank({ lastNetValueUsd }: OpenPosition): number {
  return lastNetValueUsd ?? Number.MIN_SAFE_INTEGER;
}

/**
 * Fails when a query filled a whole page: rows past it would be dropped without a sign (a Safe's
 * positions, or a position's latest value), so the list would be silently wrong. Add pagination
 * when this fires; today there are a few dozen rows.
 */
function assertFullList(table: string, items: unknown[]) {
  if (items.length >= PAGE_LIMIT) {
    throw new Error(`Indexer ${table} filled a page of ${PAGE_LIMIT}: paginate getOpenPositions`);
  }
}

async function queryIndexer<T>(
  request: APIRequestContext,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  // The indexer URL stays out of errors and reports: name the variable that holds it instead
  const response = await request.post(indexerGraphqlUrl(), { data: { query, variables } });
  if (!response.ok()) {
    throw new Error(`Indexer (${indexerUrlVariable()}) answered ${response.status()}`);
  }
  const body: { data?: T; errors?: { message: string }[] } = await response.json();
  if (!body.data || body.errors?.length) {
    throw new Error(`Indexer query failed: ${JSON.stringify(body.errors)}`);
  }
  return body.data;
}
