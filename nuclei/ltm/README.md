# `@neurome/ltm`

Long-term memory for agents — persists observations as vector embeddings in SQLite, with automatic decay, retrieval scoring, and associative graph traversal.

Part of the [Neurome](../../README.md) memory infrastructure.

## Install

```sh
pnpm add @neurome/ltm
```

## Usage

```ts
import { createLtmEngine, SqliteAdapter, OpenAIEmbeddingAdapter, LtmCategory } from '@neurome/ltm';

const storage = new SqliteAdapter('memory.db');
const embeddings = new OpenAIEmbeddingAdapter({ apiKey: process.env.OPENAI_API_KEY! });
const ltm = createLtmEngine(storage, embeddings);

// Insert a record
const insertResult = await ltm.insert('The user prefers dark mode', {
  importance: 0.8,
  category: LtmCategory.USER_PREFERENCE,
  sessionId: 'session-42',
});
// => Ok(1)  — the new record id

// Query by natural language
const queryResult = await ltm.query('display preferences', { limit: 5, threshold: 0.4 });
// => Ok([{ record: { id: 1, data: 'The user prefers dark mode', tier: 'episodic', ... },
//          effectiveScore: 0.87, rrfScore: 0.72,
//          retrievalStrategies: ['semantic', 'temporal'],
//          isSuperseded: false }])

// Link two records
ltm.relate({ fromId: 2, toId: 1, type: 'elaborates' });

// Prune decayed records (retention < 0.1)
const { pruned, remaining } = ltm.prune();
// => { pruned: 3, remaining: 47 }

// Storage stats
const stats = ltm.stats();
// => { total: 47, episodic: 30, semantic: 17, tombstoned: 3, avgStability: 12.4, avgRetention: 0.81 }
```

## API

| Export                                 | Kind      | Description                                                                                                                                                        |
| -------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `createLtmEngine(storage, embeddings)` | function  | Factory — returns a configured `LtmEngine`                                                                                                                         |
| `LtmEngine`                            | class     | Core engine: `insert`, `bulkInsert`, `update`, `delete`, `relate`, `getById`, `getRecent`, `query`, `findConsolidationCandidates`, `consolidate`, `prune`, `stats` |
| `LtmCategory`                          | const     | Category constants: `USER_PREFERENCE`, `WORLD_FACT`, `TASK_CONTEXT`, `AGENT_BELIEF`                                                                                |
| `SqliteAdapter`                        | class     | SQLite persistence backend (via `better-sqlite3`)                                                                                                                  |
| `InMemoryAdapter`                      | class     | In-process backend, suitable for tests                                                                                                                             |
| `OpenAIEmbeddingAdapter`               | class     | OpenAI `text-embedding-3-small` (1536 dims)                                                                                                                        |
| `StorageAdapter`                       | interface | Implement to add a custom persistence backend                                                                                                                      |
| `EmbeddingAdapter`                     | interface | Implement to add a custom embedding model                                                                                                                          |
| `LtmRecord`                            | type      | Persisted record shape                                                                                                                                             |
| `LtmEdge`                              | type      | Typed relationship between records (`supersedes`, `elaborates`, `contradicts`, `consolidates`)                                                                     |
| `LtmQueryResult`                       | type      | Query result with `effectiveScore`, `rrfScore`, `retrievalStrategies`, `isSuperseded`                                                                              |
| `LtmInsertOptions`                     | type      | Options for `insert`: `importance`, `tier`, `sessionId`, `category`, `episodeSummary`, `metadata`                                                                  |
| `LtmQueryOptions`                      | type      | Options for `query`: `limit`, `threshold`, `strengthen`, `tier`, `sort`, `sessionId`, `category`, `minResults`, and more                                           |
| `LtmEngineStats`                       | type      | Shape returned by `stats()`                                                                                                                                        |
| `reembedAll(adapter, storage)`         | function  | Re-embed all records with a new embedding model                                                                                                                    |

### Key behaviours

- **Retention decay** — `exp(-ageDays / stability)`; records with retention below 0.1 are pruned.
- **RRF retrieval** — semantic, temporal, and associative ranked lists are merged (k=60) to produce `rrfScore`.
- **Stability strengthening** — each retrieval increases a record's stability, modelled after spaced-repetition.
- **Tiers** — records are `episodic` (raw observations) or `semantic` (distilled facts).
- **Consolidation** — merge related episodic records into a single semantic record via `consolidate`.

Full API reference → <!-- link to docs -->

## Related

- [`@neurome/amygdala`](../amygdala/README.md) — emotional salience and importance scoring
- [`@neurome/hippocampus`](../hippocampus/README.md) — memory formation and consolidation orchestration
- [`@neurome/memory`](../memory/README.md) — unified memory facade over STM and LTM

## License

MIT
