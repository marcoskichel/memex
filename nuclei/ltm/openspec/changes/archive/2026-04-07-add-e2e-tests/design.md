## Context

`@neurome/ltm` is the foundational storage and retrieval layer for the entire neurome stack. All upper-tier packages (amygdala, hippocampus, perirhinal, memory) depend on it. Unit tests mock both `StorageAdapter` and `EmbeddingAdapter`, meaning the query pipeline (cosine similarity, RRF merge, entity-ranked filtering), consolidation mechanics, and graph traversal (`findEntityPath`) have zero real-world validation.

`@neurome/perirhinal` established the script pattern: a standalone `scripts/e2e.ts` that runs against real APIs with a temp SQLite DB.

## Goals / Non-Goals

**Goals:**

- Exercise `LtmEngine` insert, query, relate, consolidate, prune, findEntityPath, and decay against real `SqliteAdapter` + real `OpenAIEmbeddingAdapter`
- Hard-assert all outcomes (no LLM non-determinism — embeddings are deterministic for fixed inputs)
- Cover `findEntityPath` (recently added, zero real-world coverage today)
- Match the perirhinal script structure

**Non-Goals:**

- Replace unit tests or add new unit coverage
- Test LLM-dependent behavior (no LLM calls in ltm e2e)
- Test `SqliteAdapter` internals directly — exercise through `LtmEngine` API only

## Decisions

**Script vs vitest e2e tests** — raw `scripts/e2e.ts`, same as perirhinal.
Reason: explicit `pnpm run e2e` invocation is intentional and cheap to skip in standard CI.

**Deterministic assertions throughout** — unlike amygdala/hippocampus, ltm has no LLM. Embedding results for the same input string are stable. All assertions use hard `throw`, zero `console.warn` soft-fails.

**Scenario ordering: build state across scenarios** — each scenario builds on prior state so the later scenarios (findEntityPath, consolidate, prune) have meaningful data to operate on.

**findEntityPath coverage** — insert records with entity graph edges, then call `findEntityPath` and assert path length and node sequence. The path must be deterministic given the inserted graph structure.

**Consolidation scenario** — insert two episodic records, call `consolidate()` to produce a semantic record, assert sources are tombstoned and the new semantic record is queryable.

**Prune scenario** — insert a record with stability forced below the prune threshold (via direct `SqliteAdapter` manipulation or low-importance + decay), call `prune()`, assert it is removed.

**Decay events** — attach an `EventTarget` listener to the engine, trigger decay via `query()` strengthen on a decayed record, assert the event fires.

**No LtmEngine internal access** — all assertions go through public API (`getById`, `query`, `stats`, `findEntityPath`). No reaching into `storage` private fields.

## Risks / Trade-offs

[OpenAI API cost] → Each run makes ~10-15 embedding calls. Mitigated by not running in standard CI; explicit `pnpm run e2e` invocation only.

[Embedding model changes] → `text-embedding-3-small` (1536 dims) is hardcoded in `SqliteAdapter` schema. If OpenAI changes default dimensions, queries will fail. Not a risk unless the model is deprecated.

[Stability/decay mechanics] → Prune scenario requires a record below threshold. Using `importance: 0` + `accessCount: 0` + a very old `lastAccessedAt` to guarantee retention below threshold. This is white-box knowledge of the stability formula — acceptable for e2e tests.
