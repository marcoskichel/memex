# Entity Knowledge Graph (Phase 2)

Phase 1 stores entity mentions as raw metadata on `LtmRecord`. Phase 2 builds the full entity knowledge graph: dedicated storage tables, embedding-based identity resolution, typed relationship edges, and an async extraction process that populates the graph as records are written.

## Scopes

| Scope        | Change                                                                                                                                                                                                                                                         |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ltm`        | V3 migration (`entities`, `entity_edges`, `entity_record_links` tables); `sqlite-vec` for cosine similarity; four new `StorageAdapter` graph methods                                                                                                           |
| `perirhinal` | New package — `EntityExtractionProcess` that subscribes to LTM write events, extracts entity nodes and relationship edges via LLM, runs a three-tier deduplication pipeline (exact → type-first cosine → batched LLM), and writes resolved entities to storage |

## Key Design Decisions

- **sqlite-vec over a separate graph store** — keeps graph queries atomic with the rest of LTM, avoids Kuzu's 524 MB footprint
- **Type-first deduplication (m13v)** — checking entity type before cosine similarity cuts LLM confirmation calls by ~60%: same type + cosine ≥ 0.85 = merge without LLM; different types = always distinct
- **LLM confirmation is batched** — only called for same-type candidates in the [0.70, 0.85) cosine band, batched per run
- **Graph traversal depth capped at 2 for recall** — deeper traversal returns noise; explicit exploration queries may request up to 5 hops (m13v)
- **Entity knowledge survives record tombstoning** — `entity_record_links` tracks provenance without enforcing cascades; entity nodes outlive the episodic records that introduced them

## Shared Contract

```typescript
type EntityType = 'person' | 'project' | 'concept' | 'preference' | 'decision' | 'tool';

interface EntityNode {
  id: number;
  name: string; // normalized lowercase
  type: EntityType;
  embedding: Float32Array;
  createdAt: Date;
}

interface EntityEdge {
  id: number;
  fromId: number;
  toId: number;
  type: string; // e.g. 'prefers', 'depends_on', 'works_at'
  createdAt: Date;
}
```

## Deferred

- Entity edge invalidation / supersedes model
- Automatic entity pruning on record tombstone
- Relationship type normalization
