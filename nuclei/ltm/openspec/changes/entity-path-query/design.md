## Context

The entity graph currently exposes `getEntityNeighbors(entityId, depth)` which performs a directed BFS via recursive CTE and returns a flat set of reachable nodes. This answers "what is reachable?" but not "how do I get there?". The immediate use case is a QA agent that builds a navigation map of a mobile app as it explores — screen fingerprints are stored as `type: 'screen'` entities and taps are stored as `navigates_to` edges — and needs to answer "what sequence of screens and actions leads to the element I want?"

The entity graph lives in `SqliteEntityGraph`, exposed through `StorageAdapter` and `LtmEngine`. The schema currently has no `weight` on `entity_edges`, which forecloses confidence-weighted traversal.

## Goals / Non-Goals

**Goals:**

- Add `findEntityPath(fromId, toId, maxHops?)` that returns the ordered sequence of nodes and edges from source to target
- Add `weight` column to `entity_edges` for future weighted traversal without a blocking schema change later
- Keep the implementation simple and correct; performance is secondary (graph is bounded at low thousands of nodes)

**Non-Goals:**

- Weighted shortest path (Dijkstra) — weight column is added but BFS is used; Dijkstra is a future upgrade
- Bidirectional BFS — not worth the complexity at this scale
- Exposing path query through IPC/MCP — that is a consumer concern
- Any changes to `@neurome/perirhinal` or `@neurome/hippocampus`

## Decisions

### D1: Application-level BFS over `WITH RECURSIVE`

**Decision:** Implement path-finding in TypeScript, not SQL.

**Rationale:** SQLite recursive CTEs execute depth-first by default and are append-only — there is no way to guarantee shortest-path (fewest-hop) results without collecting all paths up to depth limit and post-filtering. This is fragile and slow for any non-trivial graph. Application-level BFS is level-ordered by construction, cycle-safe with a `Set<number>`, and trivially reconstructs the full path via a `parent` map. At the scale of this graph (typically dozens to a few hundred nodes per app), loading the full adjacency list in one SQL query is negligible.

**Alternatives considered:**

- `WITH RECURSIVE` with `instr()` cycle detection: correct but not guaranteed shortest-path, fragile string-matching, no easy path reconstruction
- DuckDB/sqlite-graph extensions: significant dependency, alpha-quality, unnecessary for this scale

### D2: Cached in-memory adjacency list

**Decision:** On first `findEntityPath` call (per `SqliteEntityGraph` instance), load all edges with `SELECT id, from_id, to_id, type, weight FROM entity_edges` and build a `Map<number, EdgeEntry[]>`. Invalidate and rebuild on any `insertEntityEdge` write.

**Rationale:** Avoids repeated SQL reads for consecutive path queries in the same session. The graph is small; the full adjacency list fits comfortably in memory. Invalidation on write is simple and correct.

**Alternatives considered:**

- Re-query on every `findEntityPath` call: simpler but wasteful when an agent queries paths repeatedly during exploration
- LRU cache on individual paths: more complex, unnecessary given graph size

### D3: `weight REAL NOT NULL DEFAULT 1.0` on `entity_edges`

**Decision:** Add the column now via a V4 migration, used only by the cache/BFS code to carry `weight` in `EdgeEntry`. BFS ignores it (all edges treated equally). Dijkstra upgrade is straightforward when needed: sort by `1 / weight` as edge cost.

**Rationale:** Consumers (e.g., a QA agent incrementing weight on repeated observations) need a place to store transition confidence. Adding this later would require a second migration and a second cache invalidation pass. Zero behavioral impact now — default 1.0 means all paths have equal weight.

### D4: Return type carries both node and edge identity

**Decision:** `EntityPathStep = { entity: EntityNode; via: { edgeId: number; type: string; weight: number } | null }` — `null` on the starting node.

**Rationale:** Consumers need both the screen identity (entity) and the action that caused the transition (edge type, e.g. `"navigates_to"`) to generate navigation instructions. Returning only node IDs forces a second query. The edge type is the "action label" (what was tapped) that the consumer stored when recording the transition.

## Risks / Trade-offs

- **Breaking change to `StorageAdapter`**: Any external adapter implementation must add `findEntityPath`. Mitigated by the fact that adapters are internal (`SqliteAdapter`, `InMemoryAdapter`) — no published third-party implementations exist.
- **Cache coherency**: If `insertEntityEdge` is called concurrently from two code paths, the cache may be stale. Mitigated: `better-sqlite3` is synchronous; there is no concurrent mutation within a single process. The cache is per-instance, so multiple `SqliteEntityGraph` instances on the same file (WAL mode) could diverge — but this is already true for `getEntityNeighbors` and is an accepted constraint.
- **No backward traversal**: `findEntityPath` follows directed edges only. If the navigation graph has a one-way path, the path will not be found from the other direction. This is correct behavior for a directed navigation graph.

## Migration Plan

V4 migration (additive, non-breaking):

1. `ALTER TABLE entity_edges ADD COLUMN weight REAL NOT NULL DEFAULT 1.0`
2. Set `user_version = 4`

Rollback: no data loss — column addition is reversible by dropping the column (or ignoring it at an older schema version). Existing callers that do not pass `weight` to `insertEntityEdge` continue to work; the column defaults to 1.0.
