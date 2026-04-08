# `@neurome/memory`

The hippocampus of your agent — a single factory function that wires short-term storage, long-term retrieval, importance scoring, and consolidation into a ready-to-use memory pipeline.

This is the recommended starting point for most users. If you need fine-grained control over individual subsystems, see the [Related](#related) packages below.

Part of the [Neurome](../../README.md) memory infrastructure.

## Usage

```ts
import { createMemory } from '@neurome/memory';
import { myLlmAdapter } from './adapters';

const { memory } = await createMemory({
  storagePath: './data/memory.db',
  llmAdapter: myLlmAdapter,
  sessionId: 'session-abc',
});
// => memory system initialised, background amygdala + hippocampus schedulers running

memory.logInsight({
  summary: 'User prefers dark mode and concise responses',
  contextFile: './context/user-prefs.md',
  tags: ['preferences'],
});
// => insight queued in STM, fire-and-forget

const results = await memory.recall('what are the user preferences?');
// => ResultAsync resolves to LtmQueryResult[]
// => [{ id: 42, summary: 'User prefers dark mode...', score: 0.91, ... }]

if (results.isOk()) {
  console.log(results.value[0].summary);
  // => 'User prefers dark mode and concise responses'
}

const report = await memory.shutdown();
// => { sessionId: 'session-abc', insightsDrained: 1, ltmRecordsAtClose: 42, ... }
```

## API

| Export                    | Description                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------ |
| `createMemory(config)`    | Factory — initialises all subsystems and returns `{ memory, startupStats }`          |
| `Memory`                  | Interface — full surface of the memory instance                                      |
| `MemoryConfig`            | Config shape passed to `createMemory`                                                |
| `MemoryEventEmitter`      | Typed event emitter surfaced as `memory.events`                                      |
| `MemoryEvents`            | Union of all emitted event names and their payloads                                  |
| `CreateMemoryResult`      | Return type of `createMemory` — `{ memory, startupStats }`                           |
| `ShutdownReport`          | Returned by `memory.shutdown()`                                                      |
| `PruneContextFilesReport` | Returned by `memory.pruneContextFiles()`                                             |
| `ShutdownError`           | Thrown when an operation is attempted after shutdown begins                          |
| `RecordNotFoundError`     | Returned (via `ResultAsync`) when `recallFull(id)` finds no record                   |
| `InsertMemoryError`       | Returned (via `ResultAsync`) from `insertMemory` / `approveConsolidation`            |
| `ImportTextError`         | Returned (via `ResultAsync`) from `importText`                                       |
| `RecallOptions`           | Options passed to `recall()` — extends `LtmQueryOptions` with entity position fields |
| `MemoryRecallResult`      | Result type from `recall()` — extends `LtmQueryResult` with optional `entityContext` |
| `EntityContext`           | Entity graph context attached to enriched recall results                             |

### `MemoryConfig`

| Field                   | Type               | Default                        | Description                                       |
| ----------------------- | ------------------ | ------------------------------ | ------------------------------------------------- |
| `storagePath`           | `string`           | required                       | SQLite file path                                  |
| `llmAdapter`            | `LLMAdapter`       | required                       | LLM used for scoring and consolidation            |
| `sessionId`             | `string`           | random UUID                    | Identifies the current session                    |
| `contextDirectory`      | `string`           | `dirname(storagePath)/context` | Directory for context files                       |
| `embeddingAdapter`      | `EmbeddingAdapter` | required                       | Embedding model for semantic search               |
| `stm`                   | `InsightLogLike`   | in-memory `InsightLog`         | Short-term memory store                           |
| `maxTokens`             | `number`           | `100000`                       | Token budget before STM compression triggers      |
| `amygdalaCadenceMs`     | `number`           | `300000`                       | How often the amygdala scores STM insights (ms)   |
| `hippocampusScheduleMs` | `number`           | `3600000`                      | How often the hippocampus consolidates LTM (ms)   |
| `maxLLMCallsPerHour`    | `number`           | `200`                          | Rate limit on LLM calls across all subsystems     |
| `agentState`            | `AgentState`       | —                              | Optional agent state passed to importance scoring |

### `Memory` interface (key methods)

| Method                            | Returns                                                         | Description                                                                                             |
| --------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `logInsight(options)`             | `void`                                                          | Sync, fire-and-forget write to STM                                                                      |
| `recall(nlQuery, options?)`       | `ResultAsync<MemoryRecallResult[], LtmQueryError>`              | Semantic search across LTM; enriches top results with entity context when position options are supplied |
| `recallSession(query, options)`   | `Promise<LtmQueryResult[]>`                                     | Semantic search scoped to a specific session                                                            |
| `recallFull(id)`                  | `ResultAsync<{ record, episodeSummary? }, RecordNotFoundError>` | Fetch a full LTM record by ID                                                                           |
| `insertMemory(data, options?)`    | `ResultAsync<number, InsertMemoryError>`                        | Write directly to LTM                                                                                   |
| `importText(text)`                | `ResultAsync<{ inserted: number }, ImportTextError>`            | Chunk and import a large text blob                                                                      |
| `getRecent(limit)`                | `LtmRecord[]`                                                   | Most recently accessed LTM records                                                                      |
| `consolidate()`                   | `Promise<void>`                                                 | Trigger hippocampus consolidation immediately                                                           |
| `getPendingConsolidations()`      | `PendingConsolidation[]`                                        | Low-confidence consolidations awaiting review                                                           |
| `approveConsolidation(pendingId)` | `ResultAsync<number, InsertMemoryError>`                        | Commit a pending consolidation to LTM                                                                   |
| `discardConsolidation(pendingId)` | `void`                                                          | Drop a pending consolidation                                                                            |
| `setAgentState(state)`            | `void`                                                          | Update agent state used by importance scoring                                                           |
| `getStats()`                      | `Promise<MemoryStats>`                                          | Snapshot of all subsystem metrics                                                                       |
| `pruneContextFiles(options)`      | `Promise<PruneContextFilesReport>`                              | Delete context files older than N days                                                                  |
| `shutdown()`                      | `Promise<ShutdownReport>`                                       | Graceful shutdown — drains STM and stops schedulers                                                     |

### `RecallOptions` — entity position fields

`recall()` accepts an optional second argument that extends `LtmQueryOptions` with a mutually exclusive position discriminant:

| Field               | Type       | Description                                                                                         |
| ------------------- | ---------- | --------------------------------------------------------------------------------------------------- |
| `currentEntityIds`  | `number[]` | IDs of entities that represent the caller's current context. Used as BFS seeds for path resolution. |
| `currentEntityHint` | `string[]` | Natural-language strings (e.g. entity names) embedded at query time to resolve BFS seeds.           |

Supplying both fields is a compile-time error. Supplying neither disables enrichment — behaviour is identical to calling `recall(query)` with no options.

When either field is provided, the top-3 results are enriched with an `entityContext` containing:

- `selectedEntity` — the linked entity with highest cosine similarity to the query
- `navigationPath` — BFS path from the closest seed to `selectedEntity` (`undefined` if no path)
- `originEntity` — the seed entity that produced the winning path (`undefined` if no path)
- `pathReliability` — `'ok'` (≤ 5 hops) or `'degraded'` (> 5 hops)

Full API reference → <!-- link to docs -->

## Related

- [`@neurome/stm`](../stm) — short-term memory and insight log
- [`@neurome/ltm`](../ltm) — long-term memory store and semantic retrieval
- [`@neurome/amygdala`](../amygdala) — importance scoring and emotional tagging
- [`@neurome/hippocampus`](../hippocampus) — memory consolidation and decay
- [`@neurome/cortex`](../cortex) — synapses: higher-level reasoning over memory

## License

MIT
