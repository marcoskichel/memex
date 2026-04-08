## Context

`EntityType`, `EntityNode`, `EntityEdge`, and `EntityPathStep` are currently defined in
`nuclei/ltm/src/ltm-engine-types.ts` and `nuclei/ltm/src/storage/storage-adapter.ts`.
`@neurome/perirhinal` imports these from `@neurome/ltm`, creating an unusual dependency
direction (extraction importing from storage). Moving them to `@neurome/entorhinal` makes
the dependency direction neutral.

## Goals / Non-Goals

**Goals:**

- Remove entity graph type definitions from `ltm-engine-types.ts` and `storage-adapter.ts`
- Import `EntityType`, `EntityNode`, `EntityEdge`, `EntityPathStep` from `@neurome/entorhinal`
- Update `LtmQueryOptions.entityType` to reference the canonical `EntityType`

**Non-Goals:**

- Widening `EntityType` to `string` (that is `open-entity-types`)
- Changing LTM query logic or storage behavior

## Decisions

**Types that move to `@neurome/entorhinal`:**

- `EntityType` — the union string
- `EntityNode` — `{ id, name, type, embedding, createdAt }`
- `EntityEdge` — `{ id, fromId, toId, type, weight, createdAt }` (includes `weight: number`;
  do not omit it — `StorageAdapter.insertEntityEdge` takes `Omit<EntityEdge, 'id' | 'weight'>`)
  This is the entity graph edge, not the LTM record edge `LtmEdge` which stays in ltm
- `EntityPathStep` — one step in a resolved entity navigation path
- `EntityMention` — `{ name, type }` lightweight reference
- `FindEntityPathParams` — parameter struct for `StorageAdapter.findEntityPath`; must move
  alongside `EntityPathStep` since the method signature references both

**Types that stay in ltm:**

- `LtmEdge` — the semantic edge between LTM records (`supersedes`, `elaborates`, etc.);
  this is an LTM-specific concept with no relation to the entity graph
- `LtmRecord`, `LtmQueryResult`, `LtmQueryOptions` — remain in ltm

**`LtmQueryOptions.entityType` stays typed as `EntityType`** — imported from entorhinal.
This is a filter option, not a storage concept; the field name and semantics are unchanged.

## Risks / Trade-offs

- [Risk] `entity-graph-storage` spec mentions `EntityNode` and `EntityEdge` as exported
  from `nuclei/ltm` → Mitigation: spec behavior is unchanged; only the import source
  moves. The spec documents behavior, not package boundaries.
- [Risk] Any consumer outside the monorepo importing `EntityNode` from `@neurome/ltm`
  directly would break → Mitigation: all consumers are within the monorepo; update all
  import paths atomically in the same PR
