## Context

Phase 1 entity tagging stores entity mentions in `LtmRecord.metadata.entities`. This enables single-record entity filtering and soft RRF boosting but has no cross-entity relationship model and no deduplication — "Alice", "alice", and "Alice Smith" are stored as independent observations with no shared identity.

Phase 2 adds a persistent entity graph directly in the SQLite database: deduplicated entity nodes, typed directed edges between them, and link records tying entity observations back to the `LtmRecord` that produced them.

The storage layer is responsible only for persistence and retrieval. Entity extraction and the deduplication decision pipeline live in `perirhinal`.

## Goals / Non-Goals

**Goals:**

- Add `entities`, `entity_edges`, `entity_record_links` tables via V3 migration
- Expose graph read/write methods on `StorageAdapter`
- Load `sqlite-vec` in `SqliteAdapter` to enable cosine similarity search on entity embeddings
- Provide depth-bounded neighbor traversal via recursive CTE

**Non-Goals:**

- Entity extraction from text (perirhinal)
- Deduplication decision logic — type-match check, cosine threshold evaluation, LLM confirmation (perirhinal)
- Automatic entity lifecycle pruning when source records are tombstoned (deferred)
- Entity edge invalidation / supersedes model (deferred)

## Decisions

### SQLite + sqlite-vec over a dedicated graph store

Kuzu (524 MB install) and Neo4j would break the single-file atomic transaction guarantee that the rest of the LTM relies on. `sqlite-vec` adds vector search as a native extension — cosine similarity queries over entity embeddings stay inside the same `better-sqlite3` connection with no serialization boundary.

**Alternative considered:** store embeddings in a separate file store and use a lightweight kNN index. Rejected: adds an external file, complicates backup/restore, no atomic writes.

### `findEntityByEmbedding` returns candidates; it does not decide

`findEntityByEmbedding(embedding, threshold)` returns all `EntityNode` rows with cosine similarity above `threshold`. It does not decide which, if any, is a duplicate. That decision (type-match check, LLM confirmation for the 0.70–0.85 ambiguous band) belongs to `perirhinal`. Storage stays dumb.

**Why:** The decision logic involves LLM calls and business rules that change independently of the storage schema. Keeping the boundary clean lets us tune the dedup pipeline without touching migrations.

### Depth cap: 2 hops for retrieval, 5 for explicit exploration

`getEntityNeighbors` accepts a `depth` parameter. Callers MUST pass `depth ≤ 2` for standard recall paths. Explicit exploration queries (e.g. "show me the full graph around Alice") may pass up to 5. Values above 5 are clamped. This follows field experience showing depth > 3 returns noise in practice (m13v).

### `entity_record_links` tracks provenance, not referential integrity

When a source `LtmRecord` is tombstoned, its `entity_record_links` rows are not automatically deleted and entity nodes/edges are not pruned. This is intentional — entity knowledge should outlive the episodic record that introduced it. A confidence-decay or reference-count model is deferred until the lifecycle requirements are clearer.

## Risks / Trade-offs

- **sqlite-vec native extension loading** — `SqliteAdapter` must load the extension at connection time. If `sqlite-vec` is not installed, the adapter must fail fast with a clear error rather than silently falling back to full-table scans. Risk: env setup friction in CI. Mitigation: pin version, add install step to README.
- **Entity lifecycle coupling** — tombstoning a record does not prune derived entity edges. Stale edges will accumulate over time. Mitigation: deferred; document explicitly so the team knows to revisit when pruning requirements are defined.
- **`json_each` performance for Phase 1 entity filtering** — now resolved by the dedicated `entities` table. Queries that previously scanned `metadata` JSON can migrate to joining `entity_record_links`.

## Migration Plan

V3 migration is non-destructive and additive. The three new tables have no foreign key constraints on the `records` table (link is by convention, not enforced at the DB level, to avoid cascade complexity). Migration runs automatically on adapter init via `runMigrations`, same as V2.

Rollback: not supported in-place. Users would need to restore from a pre-migration backup. Acceptable given the additive-only nature of the migration.
