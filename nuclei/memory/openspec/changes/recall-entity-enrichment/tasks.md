## 1. Types

- [x] 1.1 Add `RecallEntityPosition` discriminated union and update `RecallOptions` in `memory-types.ts`
- [x] 1.2 Add `EntityContext` interface to `memory-types.ts`
- [x] 1.3 Add `entityContext?: EntityContext` to `RecallResult` (or create a `MemoryRecallResult` wrapper type if `RecallResult` is owned by ltm)
- [x] 1.4 Export `EntityContext` and updated `RecallOptions` from `index.ts`

## 2. Constants

- [x] 2.1 Add `ENTITY_HINT_SIMILARITY_THRESHOLD` constant
- [x] 2.2 Add `ENTITY_PATH_RELIABILITY_THRESHOLD = 5` constant
- [x] 2.3 Add `ENTITY_CONTEXT_TOP_K = 3` constant

## 3. Storage — getEntitiesForRecord

- [x] 3.1 Add `getEntitiesForRecord(recordId: number): EntityNode[]` to `StorageAdapter` interface in `@neurome/ltm`
- [x] 3.2 Implement `getEntitiesForRecord` in `SqliteAdapter` (JOIN `entity_record_links` + `entities`)
- [x] 3.3 Implement `getEntitiesForRecord` in `InMemoryAdapter` (delegate to `InMemoryEntityGraph`)
- [x] 3.4 Expose `getEntitiesForRecord` on `LtmEngine`

## 4. Enrichment logic

- [x] 4.1 Create `recall-enrichment.ts` with `enrichRecallResults(params)` function
- [x] 4.2 Implement hint resolution: embed each string in `currentEntityHint`, call `findEntityByEmbedding` per hint, deduplicate resolved entities by ID
- [x] 4.3 Implement entity selection: for each result, fetch linked entities via `getEntitiesForRecord`, pick `selectedEntity` by highest cosine similarity to the recall query embedding
- [x] 4.4 Implement multi-source BFS: run `findEntityPath` from each seed to `selectedEntity`, pick shortest result; record `originEntity`
- [x] 4.5 Implement path reliability classification: `pathReliability: 'ok'` if hops ≤ `ENTITY_PATH_RELIABILITY_THRESHOLD`, else `'degraded'`
- [x] 4.6 Wire parallel enrichment: process top-`ENTITY_CONTEXT_TOP_K` results concurrently via `Promise.all`

## 5. MemoryImpl integration

- [ ] 5.1 Add `embedder` (or reuse existing embedding adapter reference) to `MemoryImplDeps` if not already present
- [ ] 5.2 Update `MemoryImpl.recall()` to accept `RecallOptions` (with position fields) and call `enrichRecallResults` when position is supplied
- [ ] 5.3 Update `Memory` interface `recall()` signature to accept `RecallOptions`

## 6. Tests

- [ ] 6.1 Unit test: `currentEntityIds` triggers enrichment; no position → no enrichment
- [ ] 6.2 Unit test: `currentEntityHint` array — each hint embedded and resolved; merged entities deduplicated
- [ ] 6.3 Unit test: hint resolution below threshold → enrichment silently skipped
- [ ] 6.4 Unit test: record with no linked entities → no `entityContext`
- [ ] 6.5 Unit test: `selectedEntity` is highest-cosine-sim entity among linked entities
- [ ] 6.6 Unit test: multi-source BFS — shortest path from any seed wins; `originEntity` correct
- [ ] 6.7 Unit test: `pathReliability: 'ok'` for ≤5 hops, `'degraded'` for >5 hops
- [ ] 6.8 Unit test: no path found → `navigationPath: null`, `originEntity: null`
- [ ] 6.9 Unit test: top-3 enrichment runs in parallel (spy on `findEntityPath` call count)
