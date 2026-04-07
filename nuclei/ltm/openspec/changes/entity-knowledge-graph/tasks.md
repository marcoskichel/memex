## 1. Dependencies

- [ ] 1.1 Add `sqlite-vec` to `package.json` dependencies
- [ ] 1.2 Verify `sqlite-vec` loads correctly in the test environment

## 2. Types

- [ ] 2.1 Add `EntityNode` type to `storage-adapter.ts`
- [ ] 2.2 Add `EntityEdge` type to `storage-adapter.ts`
- [ ] 2.3 Export `EntityNode` and `EntityEdge` from `nuclei/ltm` public index

## 3. StorageAdapter Interface

- [ ] 3.1 Add `insertEntity`, `findEntityByEmbedding`, `insertEntityEdge`, `getEntityNeighbors` to `StorageAdapter` interface

## 4. Schema Migration

- [ ] 4.1 Add V3 migration to `sqlite-schema.ts`: create `entities` table with `id`, `name`, `type`, `embedding` (BLOB), `created_at`; add `vec_index` virtual table for entity embeddings via `sqlite-vec`
- [ ] 4.2 Add V3 migration: create `entity_edges` table with `id`, `from_id`, `to_id`, `type`, `created_at`
- [ ] 4.3 Add V3 migration: create `entity_record_links` table with `id`, `entity_id`, `record_id`, `created_at`
- [ ] 4.4 Add required indexes: `idx_entities_name`, `idx_entity_edges_from`, `idx_entity_edges_to`, `idx_entity_record_links_entity`, `idx_entity_record_links_record`
- [ ] 4.5 Increment `user_version` to 3 in `runMigrations`

## 5. SqliteAdapter Implementation

- [ ] 5.1 Load `sqlite-vec` extension at connection time in `SqliteAdapter` constructor; fail fast if extension not found
- [ ] 5.2 Implement `insertEntity`: insert row, return `lastInsertRowid`
- [ ] 5.3 Implement `findEntityByEmbedding`: query `sqlite-vec` index with cosine similarity, filter by threshold, return ordered `EntityNode[]`
- [ ] 5.4 Implement `insertEntityEdge`: insert row, return `lastInsertRowid`
- [ ] 5.5 Implement `getEntityNeighbors`: recursive CTE BFS, clamp depth to [1, 5], return `EntityNode[]` excluding root

## 6. InMemoryAdapter Implementation

- [ ] 6.1 Implement `insertEntity` using in-memory Map
- [ ] 6.2 Implement `findEntityByEmbedding` using cosine similarity computed in-memory
- [ ] 6.3 Implement `insertEntityEdge` using in-memory Map
- [ ] 6.4 Implement `getEntityNeighbors` using iterative BFS with depth clamping

## 7. Tests

- [ ] 7.1 Unit tests for V3 migration: upgrade from V2, idempotency on V3
- [ ] 7.2 Unit tests for `insertEntity` and `findEntityByEmbedding` (threshold filtering, ordering, empty result)
- [ ] 7.3 Unit tests for `insertEntityEdge` and `getEntityNeighbors` (depth 1, depth 2, depth clamping, empty neighbors)
- [ ] 7.4 Unit tests for `InMemoryAdapter` covering the same entity graph scenarios
