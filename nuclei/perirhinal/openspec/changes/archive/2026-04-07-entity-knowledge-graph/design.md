## Context

Phase 1 entity tagging runs inside the amygdala's scoring pass and stores raw `EntityMention[]` in record metadata. It does not resolve identity (is "Alice" in record 42 the same "Alice" as in record 17?), does not build relationship edges, and does not deduplicate. `perirhinal` adds a downstream async process that consumes LTM write events and performs all of this work against the entity graph tables added in `ltm`.

## Goals / Non-Goals

**Goals:**

- Subscribe to LTM write events via the process lock pattern established by hippocampus
- Extract structured entity nodes and typed relationship edges from record text using LLM
- Run a three-tier deduplication pipeline to resolve entity identity before insert
- Write resolved entities, edges, and record links to `StorageAdapter`

**Non-Goals:**

- Graph traversal or query-time enrichment (that is the engine's responsibility)
- Entity edge invalidation or lifecycle pruning (deferred)
- Synchronous extraction (the process runs asynchronously after the write event)

## Decisions

### Three-tier pipeline with type-first ordering (m13v insight)

The original issue proposed: exact match → cosine similarity → LLM confirmation. m13v's field experience shows that adding entity type comparison before the cosine check cuts expensive LLM confirmations by ~60%, because:

- Same type + cosine ≥ 0.85 → almost always the same entity; merge without LLM
- Different types at any cosine similarity → almost never duplicates; treat as distinct without LLM
- LLM is reserved for: same type AND cosine in [0.70, 0.85) — the genuinely ambiguous band

Revised pipeline:

1. Exact name match (normalized lowercase) — O(1)
2. `findEntityByEmbedding(embedding, 0.70)` — fetch all candidates above minimum threshold
3. For each candidate: if types differ → skip; if cosine ≥ 0.85 → merge; if cosine in [0.70, 0.85) → LLM confirm (batched)

### Extraction uses completeStructured with a dedicated schema

Entity and relationship extraction runs as a separate LLM call using `completeStructured<T>` from `@neurome/llm`. It does not piggyback on the amygdala's scoring call. This keeps the amygdala's latency profile stable and lets extraction run asynchronously after the record is already written.

The output schema produces `ExtractedEntity[]` (name, type, confidence) and `ExtractedEdge[]` (fromName, toName, relationshipType).

### Process follows the hippocampus lock pattern

`EntityExtractionProcess` uses `StorageAdapter.acquireLock` / `releaseLock` with a TTL. It polls for new unprocessed records (records with `metadata.entities` that have no corresponding `entity_record_links` rows) and processes them in batches. This avoids a separate event bus while remaining consistent with the existing process architecture.

### Core functions are pure; shell wraps LLM and storage I/O

- `extractEntitiesFromRecord(record: LtmRecord): Result<ExtractionInput, ExtractionError>` — builds the LLM prompt payload from record text and metadata
- `resolveEntityIdentity(extracted: ExtractedEntity, candidates: EntityNode[]): EntityResolution` — pure decision: exact/merge/distinct/llm-needed
- `buildEntityInsertPlan(resolved: EntityResolution[], edges: ExtractedEdge[]): EntityInsertPlan` — pure: returns lists of nodes to insert, nodes to reuse, edges to insert, links to insert

Shell calls (`callExtractionLlm`, `persistInsertPlan`) handle all I/O and wrap results in `ResultAsync`.

## Risks / Trade-offs

- **LLM confirmation batching** — the ambiguous band may produce many LLM calls if embeddings are poorly calibrated. Mitigation: the type-first check (tier 2) should reduce this significantly in practice; monitor confirmation rate after launch.
- **Polling vs. event subscription** — polling introduces latency between record write and entity graph population. Acceptable for now; a proper event bus (if added to axon/dendrite later) would let perirhinal subscribe directly.
- **Entity relationship extraction accuracy** — LLM-extracted relationship types will be noisy and inconsistent (e.g. "works_at" vs "employed_by"). Deferred: normalize relationship types in a follow-up. For Phase 2, relationship types are stored as-is.
