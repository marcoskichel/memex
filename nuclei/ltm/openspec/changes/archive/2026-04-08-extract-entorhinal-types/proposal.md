## Why

`EntityType`, `EntityNode`, `EntityEdge`, `EntityPathStep`, and `EntityMention` are
defined inside `@neurome/ltm` but are also consumed directly by `@neurome/perirhinal`.
This makes `perirhinal` implicitly dependent on `ltm`'s internals for types it owns
conceptually. Moving them to a neutral shared package (`@neurome/entorhinal`) gives each
consumer a single canonical import and sets the stage for widening `EntityType` to
`string` without patching two packages.

## What Changes

- Remove `EntityType` from `src/ltm-engine-types.ts`
- Remove `EntityNode`, `EntityEdge` definitions from `src/storage/storage-adapter.ts`
- Remove `EntityPathStep` from wherever currently defined in ltm
- Add `@neurome/entorhinal` as a dependency
- Import all entity graph types from `@neurome/entorhinal` throughout ltm internals
- Update `LtmQueryOptions.entityType` to reference `EntityType` from `@neurome/entorhinal`

## Capabilities

### New Capabilities

None — this is a pure type relocation with no behavioral change.

### Modified Capabilities

None — no spec-level requirement changes. `entity-graph-storage` spec behavior
(insertEntity, findEntityByEmbedding, etc.) is unchanged; only where the types live moves.

## Impact

- `nuclei/ltm/package.json` gains `@neurome/entorhinal` dependency
- `src/ltm-engine-types.ts` and `src/storage/storage-adapter.ts` lose entity type definitions
- All internal ltm files that reference `EntityType`, `EntityNode`, `EntityEdge`,
  `EntityPathStep` update their import paths
- No runtime behavior changes; types remain structurally identical
