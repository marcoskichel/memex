# extract-entorhinal-types

## What

Create a new `@neurome/entorhinal` package that owns the shared entity graph types
currently duplicated across `@neurome/perirhinal` and `@neurome/ltm`. Both packages
import from `@neurome/entorhinal` instead of defining their own.

## Why

`EntityType`, `EntityNode`, `EntityEdge`, `EntityPathStep`, and `EntityMention` are
defined independently in two packages and must be kept in sync manually. This causes
drift and hidden coupling. The next change (`open-entity-types`) needs to widen
`EntityType` to `string` — doing that cleanly requires a single authoritative definition.

The name `entorhinal` follows the neuroscience anatomy used across the codebase: the
entorhinal cortex is the relay hub between the perirhinal cortex and the hippocampus,
which is exactly the architectural role this package plays.

## Scopes

- **nuclei/perirhinal** — remove own `EntityType` / `ExtractedEntity` type definitions,
  import from `@neurome/entorhinal`
- **nuclei/ltm** — remove own `EntityType` definition from `ltm-engine-types.ts` and
  `EntityNode` / `EntityEdge` from `storage-adapter.ts`, import from `@neurome/entorhinal`

## New package: nuclei/entorhinal

Exports:

- `EntityType` — union of known entity type strings (will be widened to `string` in
  the follow-on `open-entity-types` change)
- `EntityNode` — graph node with id, name, type, embedding, timestamps
- `EntityEdge` — graph edge with id, fromId, toId, relationshipType, timestamps
- `EntityMention` — lightweight `{ name, type }` reference used in record metadata
- `EntityPathStep` — one step in a resolved entity navigation path

## Dependency

This change has no upstream dependencies.

**Blocks:** `open-entity-types` — which widens `EntityType` to `string`. That change
should be applied after this one is merged.
