## ADDED Requirements

### Requirement: findEntityPath returns the shortest directed path between two entities

`StorageAdapter.findEntityPath(fromId: number, toId: number, maxHops?: number)` SHALL return an ordered array of `EntityPathStep` representing the shortest directed path (fewest hops) from `fromId` to `toId` through the entity graph. If no path exists, returns an empty array. If `fromId === toId`, returns a single-element array containing only the starting entity with `via: null`.

`maxHops` defaults to 10 and is clamped to [1, 20]. If the shortest path exceeds `maxHops`, returns an empty array.

`EntityPathStep` SHALL be defined as:

```typescript
interface EntityPathStep {
  entity: EntityNode;
  via: { edgeId: number; type: string; weight: number } | null;
}
```

The first step SHALL always have `via: null`. All subsequent steps SHALL have `via` set to the edge traversed to reach that entity.

#### Scenario: Direct path of one hop

- **WHEN** entity A has a `navigates_to` edge to entity B
- **WHEN** `findEntityPath(A.id, B.id)` is called
- **THEN** result has length 2: `[{ entity: A, via: null }, { entity: B, via: { type: 'navigates_to', ... } }]`

#### Scenario: Multi-hop path returned in order

- **WHEN** entity A → B → C via edges e1 and e2
- **WHEN** `findEntityPath(A.id, C.id)` is called
- **THEN** result is `[A (via null), B (via e1), C (via e2)]` in that order

#### Scenario: Shortest path chosen when multiple paths exist

- **WHEN** A → B → C (2 hops) and A → D → E → C (3 hops) both connect A to C
- **WHEN** `findEntityPath(A.id, C.id)` is called
- **THEN** result has length 3 (the 2-hop path via B)

#### Scenario: No path returns empty array

- **WHEN** entities A and B exist but no directed edge sequence connects A to B
- **WHEN** `findEntityPath(A.id, B.id)` is called
- **THEN** result is an empty array

#### Scenario: fromId equals toId returns single-step array

- **WHEN** `findEntityPath(A.id, A.id)` is called
- **THEN** result is `[{ entity: A, via: null }]`

#### Scenario: maxHops exceeded returns empty array

- **WHEN** the shortest path from A to B requires 8 hops
- **WHEN** `findEntityPath(A.id, B.id, 5)` is called
- **THEN** result is an empty array

#### Scenario: Cycles do not cause infinite traversal

- **WHEN** entities A → B → A form a cycle and neither A nor B connects to target C
- **WHEN** `findEntityPath(A.id, C.id)` is called
- **THEN** result is an empty array (traversal terminates, does not loop)

### Requirement: LtmEngine exposes findEntityPath

`LtmEngine.findEntityPath(fromId: number, toId: number, maxHops?: number)` SHALL delegate directly to `StorageAdapter.findEntityPath` with the same arguments and return value.

#### Scenario: LtmEngine path query delegates to storage

- **WHEN** `ltmEngine.findEntityPath(fromId, toId)` is called
- **THEN** the result matches `storage.findEntityPath(fromId, toId)` for the same inputs
