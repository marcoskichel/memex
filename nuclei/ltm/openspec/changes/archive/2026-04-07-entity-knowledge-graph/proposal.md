## Why

Phase 1 stores entity mentions in `metadata.entities` — filterable at query time but with no relationships between entities and no deduplication. Cross-entity queries ("what do we know about Alice and everything connected to her?") require a dedicated graph layer with typed edges and embedding-based identity resolution.

## What Changes

- V3 SQLite migration adds `entities`, `entity_edges`, and `entity_record_links` tables with indexes
- `sqlite-vec` loaded in `SqliteAdapter` to enable cosine similarity search over entity embeddings
- Four new methods added to `StorageAdapter`: `insertEntity`, `findEntityByEmbedding`, `insertEntityEdge`, `getEntityNeighbors`
- `getEntityNeighbors` uses a depth-bounded recursive CTE (BFS); retrieval depth capped at 2, explicit exploration queries may request up to 5
- `EntityNode` and `EntityEdge` types added to the public storage interface

## Capabilities

### New Capabilities

- `entity-graph-storage`: Dedicated entity/edge/link tables, `StorageAdapter` graph methods, and `sqlite-vec`-powered embedding deduplication for entity identity resolution

### Modified Capabilities

- `ltm-storage`: `StorageAdapter` interface gains four graph methods; `EntityNode` and `EntityEdge` types added to public exports

## Impact

- `nuclei/ltm/src/storage/sqlite-schema.ts` — V3 migration, new tables and indexes
- `nuclei/ltm/src/storage/storage-adapter.ts` — new types and interface methods
- `nuclei/ltm/src/storage/sqlite-adapter.ts` — implement new methods, load `sqlite-vec`
- `nuclei/ltm/src/storage/in-memory-adapter.ts` — implement new methods for test use
- `better-sqlite3` peer dep already present; `sqlite-vec` added as new dependency
