import { AppDatabase } from './appDatabase';
import { Chain } from './chain';
import { Indexer } from './indexer';

/**
 * The full-stack layers below the UI, each with `should…` checks, the way `App` groups the pages:
 * `stack.chain.shouldHaveMinedAll(…)`, `stack.indexer.shouldReachBlock(…)`, `stack.appDb.…`.
 */
export class Stack {
  readonly appDb = new AppDatabase();
  readonly chain = new Chain();
  readonly indexer = new Indexer();
}

export { AppDatabase, Chain, Indexer };
