# Pending Work: Human-Like Agent Memory

All original improvements from the design phase are implemented. This document tracks only what remains.

---

## Design Amendments (not yet implemented)

Decisions made during a post-implementation coverage review. These are not yet in the codebase.

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

**Rationale:** The raw context file creates an external file dependency that outlives the STM lifecycle. The STM compression output is already computed and is a high-fidelity (not very lossy) summary — more detailed than the amygdala's importance-scored insight, but a fraction of raw context size. Storing it inline eliminates the file dependency and simplifies hippocampus deletion logic.

**Changes required:**

- `LtmRecord` gains `episodeSummary?: string` (populated for episodic; null for semantic)
- SQLite schema: `episode_summary TEXT` (nullable)
- Amygdala writes `entry.text` to `episodeSummary` at insert time
- `Memory` interface gains `recallFull(id: string): Promise<{ record: LtmRecord; episodeSummary: string | null }>`
- Context files are marked `safeToDelete = true` immediately after amygdala writes `episodeSummary` — no need to retain them
- Hippocampus deletion logic simplified: delete all `safeToDelete = true` files without cross-referencing LTM records

---

## Deferred Improvements (from coverage review)

Items surfaced during the three-type memory coverage review, ranked by impact. None are implemented yet.

### High

**Isolated high-importance episodics silently vanish**

The `minClusterSize = 3` gate in `findConsolidationCandidates` means any episodic with fewer than 3 near-neighbors decays and is hard-deleted by `prune()` with no semantic promotion path — even if its importance score is high. A single critical fact stated once (e.g. "user has a nut allergy") will be lost.

Fix is amygdala-side: in `applyAction`, if `importanceScore >= threshold` and no related memory exists in LTM, insert directly as `tier: 'semantic'` rather than `tier: 'episodic'`. Make the threshold configurable in `AmygdalaConfig` (suggested default: `0.7`).

---

### Medium

**Direct semantic seeding path**

`ltm.insert()` and `ltm.bulkInsert()` are hardcoded to `tier: 'episodic'`. There is no way to bootstrap an agent with pre-existing world knowledge (domain facts, project conventions) without routing through the full STM → amygdala pipeline.

Fix: expose `tier?: 'episodic' | 'semantic'` on insert/bulkInsert options. When `tier === 'semantic'`, require `confidence` in metadata (default to `1.0` if omitted). Guard: throw if `tier === 'semantic'` is passed without `confidence`.

---

**Temporal proximity constraint in hippocampus clustering**

`findConsolidationCandidates` clusters by cosine similarity only. Episodics from different time periods (e.g. six months apart) can be consolidated together, destroying their temporal distinctness — which is the primary value of episodic memory.

Fix: add `maxCreatedAtSpreadDays?: number` to `FindConsolidationOptions` (suggested default: `30`). Clusters where `max(createdAt) - min(createdAt)` exceeds the threshold are split at the temporal gap before the LLM consolidation call.

---

**Tags not wired from STM to LTM**

`InsightEntry.tags` (agent-supplied tags like `['behavioral']`) are consumed by amygdala only for internal filtering (`permanently_skipped`, `llm_rate_limited`) and are never written to `LtmRecord`. Agent-supplied tags are silently dropped.

Fix: amygdala writes the original `entry.tags` (minus internal tags) to `LtmRecord.metadata.tags` at insert time. Expose `tags?: string[]` as an array filter in `LtmQueryOptions`.

---

### Low

**Semantic re-consolidation cycle**

When new episodics accumulate that contradict or refine an existing semantic record, there is no mechanism to produce a corrected semantic record linked via `supersedes`. The hippocampus only consolidates episodics; it never re-evaluates existing semantics against newer evidence.

Fix: a second pass in hippocampus that targets semantic records with `elaborates` or `contradicts` incoming edges from episodics created after the semantic record's `createdAt`. Produces a superseding semantic record. Defer until the base consolidation cycle is stable — risk of infinite loop without a visited-set guard.

---

**`expiresAt` on `ConsolidateOptions` for time-sensitive semantic facts**

Semantic records for time-bounded knowledge (e.g. "user is on vacation until Friday") have no explicit expiry mechanism. Standard decay is time/access-driven, not wall-clock-bound.

Fix: add `expiresAt?: Date` to `ConsolidateOptions`. When set, hippocampus tombstones the record at that wall-clock time regardless of stability. Affects only records where the caller explicitly sets it.

---

**Document procedural memory exclusion in the `Memory` interface**

The design excludes procedural memory, but the `Memory` interface gives no guidance to consumers about how to handle behavioral rule injection at startup. Agents using this library must manage that externally and currently have no indication of this.

Fix: add a JSDoc note to `Memory.recall()` and `createMemory()` noting that behavioral/procedural rules must be managed by the consumer and injected into the agent's system prompt externally.

---

## V2 Deferred (intentionally out of scope for v1)

| Capability                   | Notes                                                                             |
| ---------------------------- | --------------------------------------------------------------------------------- |
| BM25/FTS5 retrieval strategy | FTS5 table already created (no-op); wire into retrieval pipeline in v2            |
| Cross-encoder reranking      | Re-rank RRF results with a cross-encoder for higher precision                     |
| sqlite-vec ANN indexing      | Relevant only above ~20k records; brute-force cosine is sufficient at agent scale |

---

## Performance Investigation Pending

**`recall()` default `strengthen: true`** — agreed but blocked on [marcoskichel/memex#1](https://github.com/marcoskichel/memex/issues/1). Do not change the `memory-impl.ts` default until that issue is resolved.
