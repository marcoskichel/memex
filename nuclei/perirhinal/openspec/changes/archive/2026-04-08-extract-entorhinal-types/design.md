## Context

`nuclei/perirhinal/src/core/types.ts` defines `EntityType`, `ExtractedEntity`, and
`EntityMention`. The same concepts exist independently in `@neurome/ltm`. The extraction
client casts with `entity.type as ExtractedEntity['type']` because the two type
definitions are not the same object, hiding potential mismatches at compile time.

## Goals / Non-Goals

**Goals:**

- Remove local entity type definitions that duplicate `@neurome/ltm` / `@neurome/entorhinal`
- Import `EntityType`, `EntityNode`, `EntityMention` from `@neurome/entorhinal`
- Eliminate the unsafe cast in `extraction-client.ts`

**Non-Goals:**

- Widening `EntityType` to `string` (that is `open-entity-types`)
- Changing extraction logic or LLM prompts

## Decisions

**Which types move out of perirhinal:**

- `EntityType` — the union of valid entity type strings; canonical home is `@neurome/entorhinal`
- `EntityMention` — `{ name, type }` lightweight reference; shared with ltm metadata
- `ExtractedEntity` — includes `embedding` field; stays in perirhinal (it's extraction-specific),
  but its `type` field references `EntityType` from `@neurome/entorhinal`

**`ExtractedEntity` stays in perirhinal because:**

- It has an `embedding: Float32Array` field that is perirhinal-specific (populated during
  extraction before persistence)
- `@neurome/entorhinal` should not know about the extraction pipeline internals

**Import chain after change:**

```
@neurome/entorhinal   ← EntityType, EntityMention
       ↑
@neurome/perirhinal   ← ExtractedEntity (owns, references EntityType from entorhinal)
@neurome/ltm          ← EntityNode, EntityEdge (owned by entorhinal, imported here)
```

## Risks / Trade-offs

- [Risk] New package adds a pnpm workspace member and build step → Mitigation: entorhinal
  is types-only (no runtime logic), so build is trivial and fast
- [Risk] Import cycle if entorhinal accidentally depends on perirhinal or ltm → Mitigation:
  entorhinal has zero dependencies on other neurome packages; enforced by keeping it
  types-only
