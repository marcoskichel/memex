## ADDED Requirements

### Requirement: EntityNode and EntityEdge imported from @neurome/entorhinal

`@neurome/ltm` SHALL import `EntityType`, `EntityNode`, `EntityEdge`, `EntityPathStep`,
and `EntityMention` from `@neurome/entorhinal` rather than defining them. The public API
surface of `@neurome/ltm` that exposes these types (e.g. `LtmQueryOptions.entityType`,
`StorageAdapter.insertEntity`, `StorageAdapter.findEntityByEmbedding`) SHALL continue to
work identically from a consumer perspective.

#### Scenario: LTM entity types remain usable after relocation

- **WHEN** a consumer imports `EntityNode` indirectly through `@neurome/ltm`-typed APIs
- **THEN** all fields (`id`, `name`, `type`, `embedding`, `createdAt`) remain accessible
  with the same types as before
