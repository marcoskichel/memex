# `@neurome/perirhinal`

Entity extraction and knowledge graph construction for long-term memory records — identifies named entities in LTM records, deduplicates them against the existing graph using embedding similarity, and persists typed relationships between them.

Part of the [Neurome](../../README.md) memory infrastructure.

## Usage

```ts
import { EntityExtractionProcess } from '@neurome/perirhinal';
import { SqliteAdapter, OpenAIEmbeddingAdapter } from '@neurome/ltm';
import { AnthropicAdapter } from '@neurome/llm';

const storage = new SqliteAdapter('memory.db');
const llm = new AnthropicAdapter({ apiKey: process.env.ANTHROPIC_API_KEY! });
const embeddings = new OpenAIEmbeddingAdapter({ apiKey: process.env.OPENAI_API_KEY! });

const proc = new EntityExtractionProcess({
  storage,
  llm,
  embedEntity: async (entity) => {
    const result = await embeddings.embed(`${entity.name} (${entity.type})`);
    if (result.isErr()) throw new Error(result.error.type);
    return result.value.vector;
  },
});

// Process all unlinked LTM records — extracts entities, deduplicates, inserts edges
const result = await proc.run();
if (result.isErr()) console.error(result.error);
```

Records must carry an `entities` metadata field (array of `{ name, type }` objects) for the process to pick them up. Records without it are skipped.

## API

| Export                           | Kind     | Description                                                                                                |
| -------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| `EntityExtractionProcess`        | class    | Main process — `run()` acquires lock, processes all unlinked records, releases lock                        |
| `persistInsertPlan`              | function | Low-level helper — writes a resolved `EntityInsertPlan` to storage (inserts entities, edges, record links) |
| `EntityExtractionProcessOptions` | type     | Constructor options: `storage`, `llm`, `embedEntity`                                                       |
| `EntityType`                     | type     | `'person' \| 'tool' \| 'concept' \| 'project' \| 'organization'`                                           |
| `ExtractedEntity`                | type     | `{ name: string; type: EntityType; embedding?: Float32Array }`                                             |
| `ExtractedEdge`                  | type     | `{ from: string; to: string; relation: string }`                                                           |
| `EntityInsertPlan`               | type     | Resolved plan: `toInsert`, `toReuse`, `edgesToInsert`                                                      |
| `EntityResolution`               | type     | Per-entity decision: `distinct`, `exact`, `merge`, or `llm-needed`                                         |
| `ExtractionError`                | type     | `LOCK_FAILED \| LLM_ERROR \| STORAGE_FAILED`                                                               |
| `ExtractionInput`                | type     | Internal extraction prompt input shape                                                                     |

## Key behaviours

- **Lock-guarded** — `run()` acquires a `entity-extraction` advisory lock (60 s TTL) and returns `LOCK_FAILED` immediately if another process holds it.
- **Entity deduplication** — extracted entities are embedded and matched against the existing graph using cosine similarity. Exact matches (≥ 0.95) are reused; high-similarity matches (0.70–0.85) within the same type are resolved by LLM; distinct entities are inserted fresh.
- **`embedEntity` convention** — embed as `"<name> (<type>)"` (e.g. `"PostgreSQL (tool)"`) to improve embedding geometry for deduplication.
- **Idempotent edges** — duplicate edges between the same pair of entities are silently dropped by the storage layer.
- **Metadata-driven** — only records with an `entities` metadata array are processed; records without it are transparently skipped.

## Related

- [`@neurome/ltm`](../ltm/README.md) — provides `StorageAdapter`, `SqliteAdapter`, and the entity graph storage layer
- [`@neurome/llm`](../llm/README.md) — provides `LLMAdapter` used for extraction and deduplication prompts
- [`@neurome/hippocampus`](../hippocampus/README.md) — sibling background process for episodic consolidation

## License

MIT
