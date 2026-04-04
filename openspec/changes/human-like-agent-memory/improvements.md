# Pending Work: Human-Like Agent Memory

All original improvements from the design phase are implemented. This document tracks only what remains.

---

## Pending Implementation

### 1. `sessionId` as a schema column on `LtmRecord`

**Decision:** Add `session_id TEXT NOT NULL` as a first-class column in the SQLite schema, not in the `metadata` bag.

**Rationale:** `metadata` is untyped and unindexed. Session-scoped recall and hippocampus session-boundary awareness during clustering both need efficient filtering. A dedicated column enables a `(session_id, tier, created_at)` index and makes session queries O(log n).

**Changes required:**

- `LtmRecord` gains `sessionId: string`
- SQLite schema: `session_id TEXT NOT NULL` with index on `(session_id, tier, created_at)`
- Amygdala reads `sessionId` from `AmygdalaConfig` and writes it to every record it inserts
- `LtmQueryOptions` gains `sessionId?: string` filter
- `Memory` interface gains `recallSession(sessionId: string, query: string): Promise<LtmQueryResult[]>`

### 2. `category` as a generic string field with exported constants

**Decision:** Add `category?: string` to `LtmRecord` as an open string. Export a `LtmCategory` constants object rather than a closed union.

```typescript
export const LtmCategory = {
  USER_PREFERENCE: 'user_preference',
  WORLD_FACT: 'world_fact',
  TASK_CONTEXT: 'task_context',
  AGENT_BELIEF: 'agent_belief',
} as const;
```

**Rationale:** A closed union forces a version bump to add new categories. Open string + exported constants allows consumers to extend with domain-specific values (e.g. `'project_convention'`) without waiting for a library release.

**Changes required:**

- `LtmRecord` gains `category?: string`
- SQLite schema: `category TEXT` (nullable, indexed)
- `LtmQueryOptions` gains `category?: string` filter
- Amygdala does not set `category` — caller responsibility via tags or metadata. Document this.
- `ConsolidateOptions` gains optional `category?: string` for hippocampus-produced semantic records

### 3. `episodeSummary` inline on `LtmRecord` (replaces context file references)

**Decision:** Store the STM-compressed text (`InsightEntry.text`) as `episodeSummary?: string` directly on `LtmRecord` instead of a `contextFile` path pointer.

**Rationale:** The raw context file creates an external file dependency that outlives the STM lifecycle. The STM compression output is already computed and is a high-fidelity (not very lossy) summary — more detail than the amygdala's importance-scored insight, but a fraction of raw context size. Storing it inline eliminates the file dependency and simplifies hippocampus deletion logic.

**Changes required:**

- `LtmRecord` gains `episodeSummary?: string` (populated for episodic; null for semantic)
- SQLite schema: `episode_summary TEXT` (nullable)
- Amygdala writes `entry.text` to `episodeSummary` at insert time
- `Memory` interface gains `recallFull(id: string): Promise<{ record: LtmRecord; episodeSummary: string | null }>`
- Context files are marked `safeToDelete = true` immediately after amygdala writes `episodeSummary`
- Hippocampus deletion logic simplified: delete all `safeToDelete = true` files without cross-referencing LTM records

### 4. Importance-gated direct semantic promotion for singleton episodics

**Rationale:** The `minClusterSize = 3` gate in `findConsolidationCandidates` means any episodic with fewer than 3 near-neighbors decays and is hard-deleted by `prune()` with no semantic promotion path — even if its importance score is high. A single critical fact stated once (e.g. "user has a nut allergy") will be lost.

**Changes required:**

- In amygdala `applyAction`: if `importanceScore >= singletonPromotionThreshold` and the LTM relatedness check finds no existing related memory, insert directly as `tier: 'semantic'` rather than `tier: 'episodic'`
- Add `singletonPromotionThreshold?: number` to `AmygdalaConfig` (default: `0.7`)

### 5. Direct semantic seeding path

**Rationale:** `ltm.insert()` and `ltm.bulkInsert()` are hardcoded to `tier: 'episodic'`. There is no way to bootstrap an agent with pre-existing world knowledge (domain facts, project conventions) without routing through the full STM → amygdala pipeline.

**Changes required:**

- Expose `tier?: 'episodic' | 'semantic'` on `LtmInsertOptions`
- When `tier === 'semantic'`, require `confidence` in metadata (default `1.0` if omitted)
- Throw if `tier === 'semantic'` is passed without `confidence`

### 6. Temporal proximity constraint in hippocampus clustering

**Rationale:** `findConsolidationCandidates` clusters by cosine similarity only. Episodics from different time periods can be consolidated together, destroying temporal distinctness — which is the primary value of episodic memory.

**Changes required:**

- Add `maxCreatedAtSpreadDays?: number` to `FindConsolidationOptions` (default: `30`)
- Clusters where `max(createdAt) - min(createdAt)` exceeds the threshold are split at the temporal gap before the LLM consolidation call

### 7. Tags wired from STM to LTM

**Rationale:** `InsightEntry.tags` (agent-supplied tags like `['behavioral']`) are consumed by amygdala only for internal filtering and are never written to `LtmRecord`. Agent-supplied tags are silently dropped.

**Changes required:**

- Amygdala writes the original `entry.tags` (minus internal tags: `permanently_skipped`, `llm_rate_limited`) to `LtmRecord.metadata.tags` at insert time
- `LtmQueryOptions` gains `tags?: string[]` as an array filter (matches records containing all specified tags)

---

## Deferred

### Low priority

**Semantic re-consolidation cycle** — a second hippocampus pass targeting semantic records with `elaborates`/`contradicts` incoming edges from newer episodics, producing a superseding semantic record. Defer until the base consolidation cycle is stable; risk of infinite loop without a visited-set guard.

**`expiresAt` on `ConsolidateOptions`** — explicit wall-clock expiry for time-bounded semantic facts. Hippocampus tombstones the record at `expiresAt` regardless of stability.

**Document procedural memory exclusion** — JSDoc on `Memory.recall()` and `createMemory()` noting that behavioral rules must be managed by the consumer and injected into the system prompt externally.

### V2 (intentionally out of scope for v1)

| Capability                   | Notes                                                                             |
| ---------------------------- | --------------------------------------------------------------------------------- |
| BM25/FTS5 retrieval strategy | FTS5 table already created (no-op); wire into retrieval pipeline in v2            |
| Cross-encoder reranking      | Re-rank RRF results with a cross-encoder for higher precision                     |
| sqlite-vec ANN indexing      | Relevant only above ~20k records; brute-force cosine is sufficient at agent scale |

---

## Blocked

**`recall()` default `strengthen: true`** — agreed but blocked on [marcoskichel/memex#1](https://github.com/marcoskichel/memex/issues/1). Do not change the `memory-impl.ts` default until that issue is resolved.
