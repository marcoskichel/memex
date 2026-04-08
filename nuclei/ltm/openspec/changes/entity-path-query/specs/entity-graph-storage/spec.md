## ADDED Requirements

### Requirement: entity_edges has a weight column

`entity_edges` SHALL have a `weight REAL NOT NULL DEFAULT 1.0` column representing the traversal confidence or frequency of the edge. All existing `insertEntityEdge` callers that do not supply a `weight` SHALL receive the default value of 1.0. The `EntityEdge` type SHALL include `weight: number`.

#### Scenario: Edge inserted without weight gets default 1.0

- **WHEN** `insertEntityEdge({ fromId: 1, toId: 2, type: 'navigates_to', createdAt: new Date() })` is called without a `weight` field
- **THEN** the stored edge has `weight = 1.0`

#### Scenario: Edge inserted with explicit weight stores it

- **WHEN** `insertEntityEdge({ fromId: 1, toId: 2, type: 'navigates_to', weight: 3.0, createdAt: new Date() })` is called
- **THEN** the stored edge has `weight = 3.0`

#### Scenario: EntityEdge type includes weight

- **WHEN** a consumer reads an `EntityEdge` from storage
- **THEN** the `weight` field is present and typed as `number`

### Requirement: V4 SQLite migration adds weight column to entity_edges

Running `runMigrations` on a V3 database SHALL add `weight REAL NOT NULL DEFAULT 1.0` to `entity_edges` and set `user_version = 4`. Migration SHALL be idempotent.

#### Scenario: V3 database upgraded to V4

- **WHEN** `runMigrations` is called on a database at `user_version = 3`
- **THEN** `user_version` is 4 and `entity_edges` has a `weight` column with default 1.0

#### Scenario: V4 migration is idempotent

- **WHEN** `runMigrations` is called on a database already at `user_version = 4`
- **THEN** no error is thrown and `user_version` remains 4

## MODIFIED Requirements

### Requirement: insertEntityEdge persists a directed relationship edge

`StorageAdapter.insertEntityEdge(edge: Omit<EntityEdge, 'id'>)` SHALL insert a directed edge between two entity nodes and return the auto-generated id. If an edge with the same `(fromId, toId, type)` triple already exists, the call SHALL be a no-op. The return value when a duplicate is ignored is unspecified and SHALL NOT be relied upon by callers. The `weight` field is optional; if omitted it defaults to 1.0.

#### Scenario: Edge inserted between two nodes

- **WHEN** `insertEntityEdge({ fromId: 1, toId: 2, type: 'prefers', createdAt: new Date() })` is called
- **THEN** an integer id is returned and the edge is reflected in `getEntityNeighbors(1, 1)`

#### Scenario: Duplicate edge insert is a no-op

- **WHEN** `insertEntityEdge({ fromId: 1, toId: 2, type: 'prefers', createdAt: new Date() })` is called twice
- **THEN** only one edge row exists in the graph with `fromId: 1`, `toId: 2`, `type: 'prefers'`

#### Scenario: Same node pair with different type creates two edges

- **WHEN** `insertEntityEdge({ fromId: 1, toId: 2, type: 'prefers', ... })` is called
- **WHEN** `insertEntityEdge({ fromId: 1, toId: 2, type: 'works_with', ... })` is called
- **THEN** two distinct edges exist between nodes 1 and 2, one per type

#### Scenario: Edge inserted with weight stores the provided value

- **WHEN** `insertEntityEdge({ fromId: 1, toId: 2, type: 'navigates_to', weight: 5.0, createdAt: new Date() })` is called
- **THEN** the stored edge has `weight = 5.0`
