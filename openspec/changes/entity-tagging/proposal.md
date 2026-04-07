# Entity Tagging (Phase 1)

## What

Add lightweight entity extraction to the amygdala's existing LLM scoring pass. Extracted entity mentions are stored in `LtmRecord.metadata.entities`, exposed through the unified memory interface, and added to the shared IPC protocol types.

## Why

Neurome's recall is currently pure vector similarity — it finds memories _semantically related to a query_ but cannot answer "what do we know about person X" or "all memories involving project Y" without a full-text scan. Entity tagging enables structured filtering by named entity without requiring a dedicated graph store or additional LLM calls beyond what the amygdala already makes.

This is Phase 1 of a two-phase approach. Phase 2 (a full entity knowledge graph with cross-entity relationship edges) is deferred until query patterns demonstrate the need.

## Scopes

| Scope        | Change                                                                                                                |
| ------------ | --------------------------------------------------------------------------------------------------------------------- |
| `amygdala`   | Extend `AmygdalaScoringResult` to include `entities: EntityMention[]`; update the structured output schema and prompt |
| `ltm`        | Store `entities` in `LtmRecord.metadata`; extend `QueryOptions` to support entity-based filtering                     |
| `memory`     | Surface entity metadata through the unified `Memory` interface; expose entity filter in `RecallOptions`               |
| `cortex-ipc` | Add `EntityMention` type to the shared IPC protocol so axon/afferent/dendrite can pass entity data                    |

## Shared Contract

```typescript
type EntityType = 'person' | 'project' | 'concept' | 'preference' | 'decision' | 'tool';

interface EntityMention {
  name: string;
  type: EntityType;
}
```

Entity mentions are stored as-is — no deduplication, no graph edges. That belongs to Phase 2.

## Out of Scope

- Entity deduplication or merging
- Cross-entity relationship edges
- A separate `entities` table in SQLite
- `sqlite-vec` integration
- EntityExtractionProcess as a separate pipeline stage
