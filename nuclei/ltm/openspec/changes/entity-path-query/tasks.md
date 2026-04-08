## 1. Schema and Types

- [x] 1.1 Add `weight REAL NOT NULL DEFAULT 1.0` to `entity_edges` in the V4 migration in `src/storage/migrations.ts`
- [x] 1.2 Add `weight: number` field to the `EntityEdge` type in `src/storage/storage-adapter.ts`
- [x] 1.3 Update `insertEntityEdge` parameter type to accept optional `weight` (defaults to 1.0) in `StorageAdapter` interface
- [x] 1.4 Add `EntityPathStep` interface to `src/storage/storage-adapter.ts`: `{ entity: EntityNode; via: { edgeId: number; type: string; weight: number } | null }`

## 2. StorageAdapter Interface

- [x] 2.1 Add `findEntityPath(fromId: number, toId: number, maxHops?: number): EntityPathStep[]` to the `StorageAdapter` interface

## 3. SqliteEntityGraph Implementation

- [x] 3.1 Update `insertEntityEdge` in `sqlite-entity-graph.ts` to write `weight` to the new column (use provided value or default 1.0)
- [x] 3.2 Add adjacency list cache (`Map<number, EdgeEntry[]>`, where `EdgeEntry = { toId: number; edgeId: number; type: string; weight: number }`) as a private field; invalidate on every `insertEntityEdge` call
- [x] 3.3 Implement `findEntityPath` in `sqlite-entity-graph.ts` using BFS over the cached adjacency list; carry a `parent: Map<number, { fromId: number; edgeId: number; type: string; weight: number }>` for path reconstruction; clamp `maxHops` to [1, 20] with default 10

## 4. SqliteAdapter Wiring

- [x] 4.1 Delegate `findEntityPath` from `SqliteAdapter` to `SqliteEntityGraph` (matches the pattern used for `getEntityNeighbors`)

## 5. InMemoryAdapter Implementation

- [x] 5.1 Update `insertEntityEdge` in `in-memory-adapter.ts` to store `weight`
- [x] 5.2 Implement `findEntityPath` in `in-memory-adapter.ts` using the same BFS logic (operate directly over the in-memory edge list)

## 6. LtmEngine Exposure

- [x] 6.1 Add `findEntityPath(fromId: number, toId: number, maxHops?: number): EntityPathStep[]` to `LtmEngine`, delegating to `this.storage.findEntityPath`

## 7. Exports

- [x] 7.1 Export `EntityPathStep` from `src/index.ts`

## 8. Tests

- [x] 8.1 Add unit tests for `findEntityPath` in `src/__tests__/entity-graph.test.ts` covering: direct path, multi-hop path, shortest path chosen, no path, fromId === toId, maxHops exceeded, cycle safety
- [x] 8.2 Add a test for the V4 migration: V3 → V4 adds `weight` column; V4 is idempotent
- [x] 8.3 Add a test for `insertEntityEdge` with explicit weight and default weight
