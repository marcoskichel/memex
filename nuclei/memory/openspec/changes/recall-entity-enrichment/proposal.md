## Why

`MemoryImpl.recall()` returns matching LTM records but no spatial context — callers have no way to ask "where in the entity graph am I, and how does this result relate to where I'm going?" A QA agent that has built a navigation map of a UI needs to answer "how do I get to the Settings screen?" in a single call, not by stitching together `recall()` + `findEntityByEmbedding` + `findEntityPath` manually.

The `entity-path-query` change (ltm scope) adds the BFS primitive. This change wires it into `recall()` so enrichment is automatic when the caller supplies their current location.

## What Changes

- `RecallOptions` gains a mutually exclusive `currentEntityId | currentEntityHint` field — the caller's current position in the entity graph
- When either field is present, `MemoryImpl.recall()` enriches the top-3 results with entity context (linked entities + shortest navigation path from current position to the result's entity)
- `currentEntityHint` is a free-text description; `MemoryImpl` embeds it at query time and resolves the nearest entity via `findEntityByEmbedding` — no raw embeddings required from callers
- `entityContextTopK` is not exposed; always 3

## Capabilities

### New Capabilities

- `recall-entity-enrichment`: Automatic navigation-path enrichment on `recall()` — when the caller provides their current entity position, results include the shortest directed path from that position to each result's entity

### Modified Capabilities

- `recall`: `RecallOptions` gains the `currentEntityId | currentEntityHint` discriminated union; `RecallResult` gains optional `entityContext`

## Impact

- `MemoryImpl` in `@neurome/memory` — enrichment logic added to `recall()`
- `RecallOptions` type — new discriminated union field (additive, backwards-compatible)
- `RecallResult` type — new optional `entityContext` field (additive)
- Requires `entity-path-query` (ltm) to land first
- No changes to `StorageAdapter`, `LtmEngine`, or any other nucleus
