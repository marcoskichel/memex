## ADDED Requirements

### Requirement: EntityNode and EntityEdge types

`EntityNode` SHALL be defined as `{ id: number; name: string; type: EntityType; embedding: Float32Array; createdAt: Date }`. `EntityEdge` SHALL be defined as `{ id: number; fromId: number; toId: number; type: string; createdAt: Date }`. Both types SHALL be exported from `nuclei/ltm`.

#### Scenario: EntityNode fields are fully typed

- **WHEN** a consumer imports `EntityNode` from `@neurome/ltm`
- **THEN** all five fields (`id`, `name`, `type`, `embedding`, `createdAt`) are available with their declared types and no field is `unknown`

### Requirement: insertEntity persists an entity node

`StorageAdapter.insertEntity(entity: Omit<EntityNode, 'id'>)` SHALL insert the entity into the `entities` table and return the auto-generated integer id.

#### Scenario: Entity inserted and id returned

- **WHEN** `adapter.insertEntity({ name: 'alice', type: 'person', embedding: new Float32Array([0.1, 0.2]), createdAt: new Date() })` is called
- **THEN** an integer id greater than 0 is returned and the entity is retrievable by that id

#### Scenario: Duplicate name insert is not guarded at storage layer

- **WHEN** `insertEntity` is called twice with `name: 'alice'` and `type: 'person'`
- **THEN** two distinct rows are inserted and two distinct ids are returned (deduplication is the caller's responsibility)

### Requirement: findEntityByEmbedding returns candidates above threshold

`StorageAdapter.findEntityByEmbedding(embedding: Float32Array, threshold: number)` SHALL return all `EntityNode` rows whose stored embedding has cosine similarity ≥ `threshold` with the query embedding, ordered by similarity descending. Returns an empty array when no candidates exceed the threshold.

#### Scenario: Matching candidates returned above threshold

- **WHEN** `findEntityByEmbedding(queryEmbedding, 0.90)` is called and two stored entities have cosine similarity 0.95 and 0.70 respectively
- **THEN** only the entity with similarity 0.95 is returned

#### Scenario: No candidates below threshold

- **WHEN** `findEntityByEmbedding(queryEmbedding, 0.95)` is called and no stored entity exceeds 0.95 cosine similarity
- **THEN** an empty array is returned

#### Scenario: Results ordered by similarity descending

- **WHEN** three entities have cosine similarities 0.91, 0.97, and 0.93 with the query embedding and threshold is 0.90
- **THEN** results are ordered [0.97, 0.93, 0.91]

### Requirement: insertEntityEdge persists a directed relationship edge

`StorageAdapter.insertEntityEdge(edge: Omit<EntityEdge, 'id'>)` SHALL insert a directed edge between two entity nodes and return the auto-generated id.

#### Scenario: Edge inserted between two nodes

- **WHEN** `insertEntityEdge({ fromId: 1, toId: 2, type: 'prefers', createdAt: new Date() })` is called
- **THEN** an integer id is returned and the edge is reflected in `getEntityNeighbors(1, 1)`

### Requirement: getEntityNeighbors traverses the graph up to the requested depth

`StorageAdapter.getEntityNeighbors(entityId: number, depth: number)` SHALL return all `EntityNode` rows reachable from `entityId` within `depth` hops (directed BFS via recursive CTE), excluding the root node itself. `depth` SHALL be clamped to the range [1, 5].

#### Scenario: Direct neighbors returned at depth 1

- **WHEN** entity A has edges to B and C, and B has an edge to D
- **WHEN** `getEntityNeighbors(A.id, 1)` is called
- **THEN** results contain B and C but not D

#### Scenario: Two-hop neighbors returned at depth 2

- **WHEN** entity A has edges to B, B has an edge to D
- **WHEN** `getEntityNeighbors(A.id, 2)` is called
- **THEN** results contain B and D

#### Scenario: Depth clamped to 5

- **WHEN** `getEntityNeighbors(A.id, 10)` is called
- **THEN** traversal proceeds as if depth were 5 (no error, just clamped)

#### Scenario: No neighbors returns empty array

- **WHEN** `getEntityNeighbors(id, 1)` is called for an entity with no outgoing edges
- **THEN** an empty array is returned

### Requirement: V3 SQLite migration adds entity tables

Running `runMigrations` on a V2 database SHALL add `entities`, `entity_edges`, and `entity_record_links` tables and set `user_version = 3`. Migration SHALL be idempotent — running it a second time on a V3 database is a no-op.

#### Scenario: V2 database upgraded to V3

- **WHEN** `runMigrations` is called on a database at `user_version = 2`
- **THEN** `user_version` is 3 and all three new tables exist

#### Scenario: V3 database migration is a no-op

- **WHEN** `runMigrations` is called on a database already at `user_version = 3`
- **THEN** no error is thrown and `user_version` remains 3
