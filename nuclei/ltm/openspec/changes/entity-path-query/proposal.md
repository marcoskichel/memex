## Why

Agents that use the entity graph currently have no way to ask "how do I get from entity A to entity B?" — `getEntityNeighbors` returns a flat set of reachable nodes but loses the path. The immediate consumer (a QA agent building a UI navigation map) needs to answer questions like "what screen sequence leads to the Settings screen?", which requires the actual route through the graph, not just reachability.

## What Changes

- Add `findEntityPath(fromId, toId, maxHops?)` to `StorageAdapter`, `SqliteEntityGraph`, and `LtmEngine` — returns the ordered sequence of `(entity, edge)` pairs forming the shortest path between two entities
- Add `weight REAL NOT NULL DEFAULT 1.0` column to `entity_edges` — preserves the upgrade path to confidence-weighted (Dijkstra) traversal without breaking existing callers
- Implementation uses application-level BFS over a cached in-memory adjacency list loaded from one SQLite query; cache is invalidated on any `insertEntityEdge` write

## Capabilities

### New Capabilities

- `entity-path-query`: Shortest-path traversal of the entity graph — given two entity IDs, returns the ordered sequence of nodes and edges from source to target; returns empty array if no path exists within the hop limit

### Modified Capabilities

- `entity-graph-storage`: `entity_edges` gains a `weight` column (schema change); `StorageAdapter` interface gains `findEntityPath`

## Impact

- `StorageAdapter` interface (breaking for any external adapter implementations — they must add `findEntityPath`)
- `SqliteEntityGraph` — new method + schema migration
- `InMemoryAdapter` — must implement `findEntityPath`
- `LtmEngine` — exposes `findEntityPath` as a pass-through
- No changes to existing callers; `weight` defaults to 1.0 so all existing `insertEntityEdge` calls are unaffected
