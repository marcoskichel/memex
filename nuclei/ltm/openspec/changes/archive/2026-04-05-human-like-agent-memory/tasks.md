## 1. Storage Layer

- [ ] 1.1 Define `StoredRecord` and `RecordRelationship` internal types
- [ ] 1.2 Define `EngramRecord` public type (with `similarity?`, `retention?`, `effectiveScore?`, `superseded?`)
- [ ] 1.3 Define `StorageAdapter` interface (`getNode`, `putNode`, `deleteNode`, `allNodes`, `getEdge`, `putEdge`, `deleteEdge`, `edgesFrom`, `edgesTo`)
- [ ] 1.4 Implement `InMemoryAdapter`: Map-based nodes + edges with `edgesFrom`/`edgesTo` indexes
- [ ] 1.5 Implement `SqliteAdapter`: better-sqlite3 schema (nodes + relationships tables), BLOB for embeddings, JSON for metadata; prepared statements for all ops
- [ ] 1.6 Write unit tests for `InMemoryAdapter` (all adapter operations)
- [ ] 1.7 Write unit tests for `SqliteAdapter` (all adapter operations, using temp file)
- [ ] 1.8 Implement `insert()`, `bulkInsert()`, `update()` (metadata-only), `delete()` (cascades edges), `relate()` on `LtmEngine`
- [ ] 1.9 Write unit tests for CRUD operations and edge creation/deletion

## 2. Decay & Stability

- [ ] 2.1 Implement `stability-manager.ts`: `initialStability(importance)`, `retention(record)`, `growthFactor(retentionAtRetrieval)`, `strengthen(record, normalizedConfidence)`
- [ ] 2.2 Apply `initialStability` on `insert()` and `relate()`
- [ ] 2.3 Write unit tests: stability formula, retention at age 0/1/10 days, growth factor at various retention values, 365-day cap

## 3. Query

- [ ] 3.1 Implement `query()`: embed query → compute effectiveScore per record → filter by threshold → load edges for candidates → apply superseded tagging (retention > 0.3) → sort → strengthen proportionally
- [ ] 3.2 Implement structured filter support in `query()`: `tier`, `minImportance`, `after`/`before`, `minStability`, `minAccessCount`
- [ ] 3.3 Implement `sort` option: `confidence` (default), `recency`, `stability`, `importance`
- [ ] 3.4 Implement `strengthen: false` mode (no side effects on records or edges)
- [ ] 3.5 Write unit tests: effective score computation, threshold filtering, superseded tagging with high-retention edge, no-tag behaviour with low-retention edge, graduated strengthening, structured filters, sort modes

## 4. Consolidation & Pruning

- [ ] 4.1 Implement `findConsolidationCandidates({ similarityThreshold?, minAccessCount? })`: groups episodic records by cosine similarity
- [ ] 4.2 Implement `consolidate(sourceIds[], data, { metadata?, deflateSourceStability? })`: creates semantic record, inherits max stability × 1.5, creates `consolidates` edges, optionally deflates sources
- [ ] 4.3 Implement `prune({ minRetention?, tier? })`: removes records below retention threshold, cascades edges
- [ ] 4.4 Implement `stats()`: total, episodic, semantic, avgStability, avgRetention
- [ ] 4.5 Write unit tests for all consolidation and pruning operations
- [ ] 4.6 Export public API from `src/index.ts`: `LtmEngine`, `createLtmEngine`, all public types and adapters
