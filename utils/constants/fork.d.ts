/** Types for `fork.js` (plain JS so the Node scripts can import it). */
export declare const FORK_BLOCKS_FILE: URL;

export declare const PINNED_FORK_BLOCKS: Readonly<Record<string, number>>;

export declare const FORK_UPSTREAM_RPCS: Readonly<Record<number, readonly string[]>>;

export declare function servesStateAt(
  url: string,
  block: number,
  timeoutMs?: number,
): Promise<boolean>;

export declare function parseBlockNumber(value: string): number;

export declare function checkNewPin(args: {
  block: number;
  finalized: number;
  current?: number | null;
}): { error?: string; warnings: string[] };

export declare function resolveForkBlock(
  chainId: number,
  override?: string | null,
  pins?: Readonly<Record<string, number>>,
): number | null;
