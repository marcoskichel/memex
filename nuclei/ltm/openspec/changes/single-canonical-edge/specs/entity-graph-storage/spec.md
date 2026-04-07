## MODIFIED Requirements

### Requirement: insertEntityEdge persists a directed relationship edge

`StorageAdapter.insertEntityEdge(edge: Omit<EntityEdge, 'id'>)` SHALL insert a directed edge between two entity nodes and return the auto-generated id. If an edge with the same `(fromId, toId, type)` triple already exists, the call SHALL be a no-op. The return value when a duplicate is ignored is unspecified and SHALL NOT be relied upon by callers.

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
