## Why

Two amygdala-side improvements were deferred from the main implementation. Both address silent data loss: critical singleton facts decay and are hard-deleted with no semantic promotion path, and agent-supplied tags are consumed internally but never forwarded to LTM where they could serve as retrieval filters.

## What Changes

- **Item 1 — Singleton promotion:** `AmygdalaConfig` gains `singletonPromotionThreshold?: number` (default `0.7`). In `applyAction`, when the scoring result is `insert`, `importanceScore >= singletonPromotionThreshold`, and the LTM relatedness check found no existing related memories, the record is written with `tier: 'semantic'` instead of `tier: 'episodic'`. It bypasses hippocampus consolidation and is never subject to the `minClusterSize = 3` eviction gate.
- **Item 2 — Tag forwarding:** `InsightEntry.tags` minus internal amygdala tags (`permanently_skipped`, `llm_rate_limited`) are written to `LtmRecord.metadata.tags` at insert time. `LtmQueryOptions` gains `tags?: string[]` (AND-semantics: record must contain ALL specified tags). Both `SqliteAdapter` and `InMemoryAdapter` apply the filter.

## Capabilities

### New Capabilities

- `amygdala-singleton-promotion`: high-importance episodics with no near-neighbors are promoted directly to semantic tier, preventing silent loss of critical facts
- `ltm-tag-filter`: agent-supplied tags survive through to LTM records and can be used as retrieval filters

### Modified Capabilities

- `amygdala-scoring`: `applyAction` extended with singleton promotion branch
- `ltm-query`: `LtmQueryOptions` extended with `tags?` filter

## Impact

- `packages/amygdala`: `AmygdalaConfig` type, `applyAction` logic
- `packages/ltm`: `LtmQueryOptions` type, `SqliteAdapter.query()`, `InMemoryAdapter.query()` (via `filterCandidates`)
- **Depends on `ltm-schema-extensions` being merged first** — the `tier` override on `LtmInsertOptions` introduced there is required for Item 1's direct semantic insertion
