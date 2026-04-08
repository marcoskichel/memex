## Context

`MemoryImpl.recall()` wraps `LtmEngine.query()` and returns ranked LTM records. The entity graph (entities + edges) lives in `StorageAdapter`. The `entity-path-query` change adds `findEntityPath(fromId, toId, maxHops?)` to `StorageAdapter` and `LtmEngine`. This change adds an enrichment layer on top of `recall()` that automatically computes navigation paths when the caller provides their current position.

The immediate consumer is a QA agent that stores screen fingerprints as `type: 'screen'` entities and taps as `navigates_to` edges. It needs to answer "how do I get to the settings screen?" in one call.

## Goals / Non-Goals

**Goals:**

- Enrich `recall()` results with entity context and navigation path when current position is provided
- Accept current position as either an entity ID (exact) or a free-text hint (resolved at query time via embedding)
- Keep the API minimal — no tuning knobs exposed; enrichment is automatic when position is supplied

**Non-Goals:**

- Exposing `entityContextTopK` — always 3 internally
- Intent detection or deciding when to enrich — caller opts in by supplying `currentEntityId` or `currentEntityHint`
- Changes outside `@neurome/memory` — `StorageAdapter` and `LtmEngine` are untouched by this change
- Weighted path selection (Dijkstra) — BFS from `entity-path-query` is sufficient

## Decisions

### D1: Discriminated union for current position

**Decision:**

```typescript
type RecallEntityPosition =
  | { currentEntityIds: number[]; currentEntityHint?: never }
  | { currentEntityHint: string[]; currentEntityIds?: never }
  | { currentEntityIds?: never; currentEntityHint?: never };

type RecallOptions = LtmQueryOptions & RecallEntityPosition;
```

**Rationale:** Both fields being present is a caller error with no sensible merge strategy. A discriminated union makes it a compile-time error rather than a runtime ambiguity. The third branch (neither) preserves backwards compatibility — existing callers pass no position and get no enrichment. Both fields are arrays — `currentEntityIds` for exact IDs, `currentEntityHint` for free-text descriptions — matching symmetry. The single-entity/hint case is the N=1 degenerate.

### D2: `currentEntityHint` strings are each resolved at query time via embedding

**Decision:** When `currentEntityHint` is provided, `MemoryImpl` calls `this.embedder.embed(hint)` for each string, then `storage.findEntityByEmbedding(embedding, threshold)` for each. All resolved entities across all hints are merged (deduplicated by ID) and become BFS seeds (see D9).

**Rationale:** Callers work with descriptions naturally (e.g., `"Alice working on Project X at Acme Corp"`). The hint string embeds to a context vector; resolving to top-N entities rather than exactly 1 captures the composite nature of context — a thought about Alice and Project X should seed BFS from both. The embedding model is already instantiated in `MemoryImpl` for `recall()` itself — a second embed call is marginal overhead. The hint interface is more biologically accurate than the ID interface: per the temporal context model (Howard & Kahana, 2002), context is always a distributed composite vector.

If resolution produces no entities above threshold, enrichment is silently skipped — `entityContext` is absent. This is a graceful degrade, not an error.

### D3: `entityContextTopK = 3` (internal constant)

**Decision:** Always enrich the top 3 results. Not configurable.

**Rationale:** Exposing this knob adds API surface with no clear user need. 3 is a sensible default for the known use case — an agent typically needs to know about the most relevant destinations, not an arbitrary N. If this proves wrong, the constant can be promoted to an option later without a breaking change.

### D4: Enrichment is parallel over top-K results

**Decision:** Resolve entity links for the top 3 results in parallel, then call `findEntityPath` for each in parallel. Collect results, attach to `RecallResult.entityContext`.

**Rationale:** `findEntityPath` operates over an in-memory adjacency list cache (per D2 of `entity-path-query` design) — each call is cheap. Parallelising 3 calls has no meaningful overhead and avoids artificial serialisation.

### D5: `entityContext` structure

**Decision:**

```typescript
interface EntityContext {
  entities: EntityNode[]; // entities linked to the recalled record (perirhinal extraction)
  selectedEntity: EntityNode; // destination: highest cosine sim to query
  originEntity: EntityNode | null; // BFS seed that produced the path; null if no current context provided
  navigationPath: EntityPathStep[] | null;
  pathReliability: 'ok' | 'degraded';
  entityResolved: boolean;
}
```

`RecallResult` gains `entityContext?: EntityContext`.

- `entityContext` **absent** = enrichment not requested (no position supplied, or `currentEntityHint` failed to resolve above threshold)
- `entityContext` present with `navigationPath: null` = enrichment requested and entity resolved, but no directed path exists from any seed to `selectedEntity`
- `entityContext` present with `navigationPath: EntityPathStep[]` = full route

`entities` — the entities perirhinal linked to this record at ingestion time via `entity_record_links`. Describes what the record is _about_, distinct from path nodes.

`selectedEntity` — the path destination; highest cosine similarity to the recall query among `entities`.

`originEntity` — which seed produced the winning path when multiple seeds are active. Always present (non-null) when `entityContext` is present and a path was found.

`entityResolved: boolean` — always true when `entityContext` is present; keeps type narrowing simple.

**Rationale:** The three states (absent / present+null / present+path) are semantically distinct. `originEntity` makes multi-source results interpretable without requiring callers to inspect the first step of `navigationPath`.

### D6: Path length reliability signal (PathRAG pattern — degrade, not suppress)

**Decision:** `findEntityPath` is called with the default `maxHops` (10). The full path is returned regardless of length. `pathReliability` is then set:

- `'ok'` if the path has ≤ 5 hops (i.e., `navigationPath.length - 1 <= 5`)
- `'degraded'` if the path has > 5 hops

`navigationPath: null` means BFS found no path within `maxHops = 10`. It does not mean the path was "too long" — that case produces a path with `pathReliability: 'degraded'`.

The 5-hop threshold is a named internal constant (`ENTITY_PATH_RELIABILITY_THRESHOLD = 5`).

**Rationale:** The previous wording was ambiguous — it was unclear whether BFS was capped at 5 (making `'degraded'` unreachable) or run higher. This decision: BFS always runs at depth 10; the 5-hop boundary is a post-hoc reliability classification, not a search cutoff. Inspired by PathRAG (arxiv:2502.14902): path length as a reliability signal. The consumer chooses whether to act on degraded paths.

### D7: Enrichment lives in `MemoryImpl`, not `LtmEngine`

**Decision:** All enrichment logic is in `@neurome/memory`'s `MemoryImpl.recall()`. `LtmEngine` is not modified.

**Rationale:** `LtmEngine` is a thin query layer over `StorageAdapter`. Contextual enrichment (deciding what graph context to fetch alongside a memory) belongs in the higher-level `MemoryImpl`. Pushing enrichment into `LtmEngine` would couple a low-level storage abstraction to a high-level agent concern. Biological alignment: perirhinal = entity recognition (ltm), `MemoryImpl` = contextual integration layer (memory nucleus).

### D8: `navigationPath` destination when a result has multiple linked entities

**Decision:** Path to the **primary entity** — the linked entity with highest cosine similarity to the recall query embedding. Tie-breaking: stable array-index order from `entity_record_links`. Degenerate case (one linked entity): trivially the only option.

**Rationale:** The recall query embedding is already computed to rank records — reusing it to select the path destination is zero-cost and causally coherent. The most query-relevant entity is the most useful navigation target. `selectedEntity` in `EntityContext` makes this destination explicit.

### D9: Multi-source BFS for current entity context

**Decision:** When multiple current entities are provided — either via `currentEntityIds: number[]` or via `currentEntityHint` resolved to N entities (see D2) — BFS is seeded with all N nodes simultaneously. The shortest path from any seed to `selectedEntity` is returned. `originEntity` in `EntityContext` records the winning seed. Single-entity behavior is the N=1 degenerate case — no branching.

**Rationale:** Multi-source BFS is a strict generalisation of single-source BFS. A consumer's current context ("Alice working on Project X") naturally maps to multiple graph seeds; insisting on a single starting node would require the consumer to resolve ambiguity that Neurome can handle internally. Mirrors the temporal context model (Howard & Kahana, 2002): context is always a composite vector, never a scalar position.

## Risks / Trade-offs

- **`entity-path-query` dependency**: This change is a no-op until `entity-path-query` lands. `findEntityPath` must exist on `StorageAdapter`. Mitigation: list as a hard prerequisite; do not implement until unblocked.
- **Embedding latency for `currentEntityHint`**: One extra embed call per `recall()` when hint is provided. Prefer `currentEntityIds` for latency-sensitive paths. Acceptable for the known use cases.
- **Silent enrichment skip on failed hint resolution**: If the hint doesn't resolve above the similarity threshold, `entityContext` is absent entirely. The similarity threshold is a named constant (`ENTITY_HINT_SIMILARITY_THRESHOLD`). Callers should document the consequence of a failed hint rather than silently receiving un-enriched results.
- **Wrong-entity resolution risk**: A permissive threshold produces a plausible-looking but incorrect `navigationPath` from the wrong current position. The named constant makes this tunable without an API change. Silent wrong enrichment is worse than silent no enrichment — the threshold should err on the side of strictness.
- **Non-goals — PathRAG path diversity**: Returning multiple distinct paths to the same destination (path diversity) is a known future extension. Currently only the shortest path is returned.
