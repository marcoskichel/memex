## Why

`EntityType` and related entity types are defined locally in `perirhinal/src/core/types.ts`
but also needed by `@neurome/ltm`. The two definitions are kept in sync manually and can
diverge — evidenced by the unsafe `as ExtractedEntity['type']` cast in `extraction-client.ts`.
A canonical shared package eliminates the drift.

## What Changes

- Remove `EntityType`, `ExtractedEntity`, `EntityMention` local type definitions from
  `src/core/types.ts` where they duplicate what `@neurome/ltm` or a shared package owns
- Add `@neurome/entorhinal` as a dependency
- Import `EntityType`, `EntityNode`, `EntityMention` from `@neurome/entorhinal`
- Remove the unsafe `entity.type as ExtractedEntity['type']` cast in `extraction-client.ts`
  (types are now canonical and no cast is needed)

## Capabilities

### New Capabilities

None — this is a pure type relocation with no behavioral change.

### Modified Capabilities

None — no spec-level requirement changes.

## Impact

- `nuclei/perirhinal/package.json` gains `@neurome/entorhinal` dependency
- `src/core/types.ts` shrinks (entity type definitions removed)
- `src/shell/clients/extraction-client.ts` loses unsafe cast
- No runtime behavior changes; types remain structurally identical
