# Improvements Design: Human-Like Agent Memory

## Overview

Four specialist researchers investigated four critical gaps in the existing design: embedding architecture and multi-strategy retrieval, LLM adapter design, memory integrity and consistency, and observability and lifecycle management. This document unifies their proposals into a single authoritative design, resolves all inter-researcher conflicts, and establishes precise TypeScript contracts for every new capability. Every decision is evaluated against the north star: does it make the system more faithfully human-like, or does it trade biological fidelity for engineering convenience?

---

## Conflicts Resolved

| Conflict                      | Resolution                                                                                                           | Rationale                                                                                                                                                  |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Context file deletion owner   | Amygdala marks `safeToDelete = true`; hippocampus performs the physical deletion in its pruning pass                 | Keeps hot amygdala cycle free of disk I/O; bundles cleanup with the existing offline maintenance pass                                                      |
| `createMemory()` return type  | Changed to `{ memory, startupStats }` — this is a breaking change from the current implied bare `Memory` return      | Inherited state on restart is operationally critical; a caller cannot know what was processed in a crashed prior session without startup stats             |
| Default embedding adapter     | `TransformersJsAdapter` (local, `all-MiniLM-L6-v2`, 384-dim) is the default                                          | Zero API key required; works out of the box; local inference eliminates network failure as a write-path risk                                               |
| Mutual exclusion mechanism    | `process_locks` SQLite table with TTL-based stale recovery, not in-memory advisory flag                              | In-memory flag is unrecoverable on crash; the advisory flag design was acknowledged as insufficient by the integrity researcher                            |
| Confidence stability formula  | `max(source stabilities) × (1.0 + confidence × 0.5)` — range: `×1.0` at `confidence=0` to `×1.5` at `confidence=1.0` | Consistent across LLM and integrity researchers; unchanged behavior at full confidence; low-confidence memories decay faster without special-case deletion |
| Default LLM model             | `claude-haiku-3-5` for both amygdala and hippocampus                                                                 | Both operations are classification/summarization, not reasoning; Haiku cost is ~$2.20/day per agent at normal cadence                                      |
| FTS5 table creation timing    | Create FTS5 virtual table during v1 schema init; do NOT wire into retrieval pipeline until v2                        | Zero storage cost in content-mode; avoids painful schema migration when BM25 is activated in v2                                                            |
| LLM adapter package placement | New `@neurokit/llm` package; not co-located inside amygdala or hippocampus                                           | Both processes share the same adapter shape; a shared package prevents interface drift and enables consumers to inject a single shared adapter instance    |
| Embedding in LLMAdapter       | Embedding is explicitly NOT part of `LLMAdapter`                                                                     | Anthropic has no embedding API; the two concerns are orthogonal and must remain separate                                                                   |
| Cost guard numbers            | `lowCostModeThreshold: 150`, `maxLLMCallsPerHour: 200`                                                               | LLM researcher's numbers are concrete and were validated against Haiku token estimates                                                                     |

---

## Design Decisions

### 1. Embedding Architecture

**Biological rationale:** Human semantic memory is encoded in terms of meaning, not surface character patterns. The existing random-weight char-level `NeuralEmbedder` produces character-similarity, not semantic similarity — two different phrasings of the same idea will not match. Replacing it with a trained sentence encoder restores the semantic encoding the hippocampus performs during memory formation.

#### EmbeddingAdapter interface

Defined in `@neurokit/ltm`. All embedding operations go through this interface; no embedding logic exists elsewhere.

```typescript
// packages/ltm/src/core/embedding-adapter.ts

export interface EmbedResult {
  vector: Float32Array;
  modelId: string;
  dimensions: number;
}

export type EmbedError =
  | { type: 'EMBED_API_UNAVAILABLE'; cause: unknown }
  | { type: 'EMBED_DIMENSION_MISMATCH'; expected: number; actual: number }
  | { type: 'EMBED_EMPTY_INPUT' };

export interface EmbeddingAdapter {
  readonly modelId: string;
  readonly dimensions: number;
  embed(text: string): ResultAsync<EmbedResult, EmbedError>;
}
```

#### TransformersJsAdapter (default)

- Model: `Xenova/all-MiniLM-L6-v2`, 384 dimensions
- Local inference via `@xenova/transformers` (WASM, Node-compatible)
- No API key required; no network dependency
- Lazy pipeline initialization on first `embed()` call
- ~2s cold start on first call; sub-10ms thereafter

#### OpenAIEmbeddingAdapter (option)

- Model: `text-embedding-3-small`, 1536 dimensions
- Requires `apiKey` at construction
- Fails fast with `EMBED_API_UNAVAILABLE` on network error; no silent fallback

#### EmbeddingMeta on records

Every `LtmRecord` carries:

```typescript
export interface EmbeddingMeta {
  modelId: string;
  dimensions: number;
}

// Addition to LtmRecord
embeddingMeta: EmbeddingMeta;
```

The `SqliteAdapter` persists `embedding_model_id TEXT NOT NULL` and `embedding_dimensions INTEGER NOT NULL` alongside the embedding BLOB.

#### Embedding model mismatch detection

Before executing a query, `queryLtm` checks `adapter.modelId` against the stored `embeddingMeta.modelId`. On mismatch:

```typescript
export type LtmQueryError =
  | EmbedError
  | { type: 'QUERY_STORAGE_FAILED'; cause: unknown }
  | { type: 'EMBEDDING_MODEL_MISMATCH'; storedModelId: string; queryModelId: string };
```

No silent degradation. Mixing vector spaces produces nonsense cosine scores.

#### reembedAll migration utility

```typescript
// packages/ltm/src/shell/re-embed.ts

export type ReembedError = EmbedError | { type: 'REEMBED_STORAGE_FAILED'; cause: unknown };

export function reembedAll(
  adapter: EmbeddingAdapter,
  storage: StorageAdapter,
): ResultAsync<{ reembedded: number }, ReembedError>;
```

Consumer-driven, explicit migration. No automatic re-embedding on startup (would silently burn API credits or CPU and may leave a half-migrated store on crash).

---

### 2. Multi-Strategy Retrieval

**Biological rationale:** Human recall is triggered simultaneously by multiple cues — what something means (semantic), when it happened (temporal), what it connects to (associative), and how significant it was (salience). A single cosine similarity pass captures only the first signal. The three-strategy RRF pipeline mirrors the multi-cue nature of human memory retrieval.

#### v1 Retrieval Pipeline

Three strategies run in parallel and merge with Reciprocal Rank Fusion (RRF, `k=60`).

**Strategy 1 — Semantic cosine**

- Embed query via injected `EmbeddingAdapter`
- Cosine similarity against all stored vectors
- Score: `cosineSimilarity(queryVec, recordVec)`
- Biological analog: semantic encoding overlap — what the memory means

**Strategy 2 — Temporal-weighted cosine**

- Multiply semantic score by retention: `effectiveScore = cosineSimilarity × retention`
- Retention already computed by the decay formula: `e^(-(age_days / stability))`
- Biological analog: Ebbinghaus forgetting curve — recent or rehearsed memories are more accessible

**Strategy 3 — Associative graph traversal (one hop)**

- For every top-K semantic hit, follow outbound edges (`elaborates`, `supersedes`, `consolidates`)
- Add connected records to the candidate pool with a discounted score: `linkedScore = sourceEffectiveScore × edgeRetention × 0.7`
- `contradicts` edges surface the contradiction pair; both are marked for the caller to resolve
- Biological analog: spreading activation — recalling one concept primes connected concepts

#### RRF merge

```typescript
// packages/ltm/src/core/rrf-merge.ts

export interface RankedCandidate {
  recordId: number;
  rank: number;
}

const RRF_K = 60;

export function rrfMerge(rankedLists: RankedCandidate[][]): Map<number, number>;
```

Records present in multiple strategy outputs rank higher — analogous to a memory that is simultaneously semantically relevant, recent, and associatively primed.

#### Updated LtmQueryResult

```typescript
export interface LtmQueryResult {
  record: LtmRecord;
  effectiveScore: number;
  rrfScore: number;
  retrievalStrategies: ('semantic' | 'temporal' | 'associative')[];
  isSuperseded: boolean;
  confidence?: number; // present only for tier === 'semantic'
}
```

#### Graduated strengthening post-merge

- Top result gets full growth factor
- Lower results get `fullGrowth × (record.rrfScore / topResult.rrfScore)`
- Graph-traversal additions get 50% of the growth factor of the direct semantic hits
- Biological analog: attentional focus — the most salient recalled item gets the most rehearsal benefit

#### Deferred to v2

- BM25/FTS5 keyword search (Strategy 4) — FTS5 table created now, wired in v2
- Cross-encoder reranking — expensive per batch; diminishing returns at agent scale
- Emotional salience as a distinct signal beyond `stability` — `stability` is a sufficient proxy for v1

---

### 3. LLM Adapter

**Biological rationale:** The amygdala and hippocampus are biological circuits, not tied to any one substrate. The `LLMAdapter` interface keeps both processes substrate-agnostic, allowing the same biological behavior to be expressed through different LLM backends.

The `LLMAdapter` interface, `AnthropicAdapter`, and `OpenAICompatibleAdapter` live in a new `@neurokit/llm` package. Both amygdala and hippocampus depend on `@neurokit/llm`. A single adapter instance may be shared between both processes.

#### LLMAdapter interface

```typescript
// packages/llm/src/llm-adapter.ts

export interface LLMRequestOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface StructuredOutputSchema<T> {
  name: string;
  description: string;
  shape: Record<string, unknown>;
  parse: (raw: unknown) => T;
}

export interface LLMAdapter {
  complete(prompt: string, options?: LLMRequestOptions): Promise<string>;
  completeStructured<T>(
    prompt: string,
    schema: StructuredOutputSchema<T>,
    options?: LLMRequestOptions,
  ): Promise<T>;
}
```

No provider-specific types leak through the public API boundary. Embedding is explicitly out of scope for `LLMAdapter` — Anthropic has no embedding API and the two concerns are orthogonal.

#### AnthropicAdapter (primary)

```typescript
// packages/llm/src/anthropic-adapter.ts

export class AnthropicAdapter implements LLMAdapter {
  constructor(apiKey: string, model = 'claude-haiku-3-5');
}
```

- `completeStructured` uses Anthropic's `tool_use` with `tool_choice: { type: 'tool', name: schema.name }` — guarantees the model returns a structured tool call rather than prose
- `complete` uses the standard `messages.create` path
- Does not re-export any `@anthropic-ai/sdk` types

#### OpenAICompatibleAdapter (fallback)

```typescript
// packages/llm/src/openai-compatible-adapter.ts

export interface OpenAICompatibleClient {
  chat: {
    completions: {
      create(params: unknown): Promise<{
        choices: Array<{ message: { content: string | null } }>;
      }>;
    };
  };
}

export class OpenAICompatibleAdapter implements LLMAdapter {
  constructor(client: OpenAICompatibleClient, model: string);
}
```

- `completeStructured` uses JSON mode: appends schema shape to prompt, parses response JSON
- Accepts any OpenAI-compatible client: OpenAI SDK, Together, Ollama, etc.

#### Model defaults

Both amygdala and hippocampus default to `claude-haiku-3-5`. Haiku is appropriate for both: amygdala is a classifier, hippocampus is a summarizer. Reasoning-class models must not be used for either — they are slower and more expensive with no quality benefit for these operations.

---

### 4. Amygdala LLM Integration

**Biological rationale:** The amygdala evaluates stimuli for emotional/behavioral significance rapidly and pre-consciously. It does not reason — it pattern-matches against salience signals. The prompt is structured as a fast classifier, not an analyst.

#### System prompt (fixed at adapter init)

```
You are a memory salience classifier for an AI agent's long-term memory system.
Your job is to decide whether a new observation is worth storing and how it relates
to what the agent already knows.

You classify FAST. You do not explain at length. You produce exactly one tool call.

Actions:
- insert: The observation is novel and important enough to store independently.
- relate: The observation connects meaningfully to an existing memory and should be linked.
- skip: The observation is trivial, redundant, or not worth persisting.

Edge types (only for relate):
- elaborates: The new observation adds detail to an existing memory.
- supersedes: The new observation updates or corrects an existing memory.
- contradicts: The new observation conflicts with an existing memory.

Importance score 0.0–1.0:
- 0.0–0.2: Noise. Background chatter. No informational value.
- 0.2–0.5: Mildly relevant but not critical.
- 0.5–0.8: Clearly important to the agent's task or goals.
- 0.8–1.0: Critical. Rare. Reserve for facts that fundamentally change agent behavior.
```

#### User turn template

```
## New Observation
{{insight_text}}

## Session Context
Source file: {{context_file_path}}
Excerpt (first 200 chars): {{context_file_excerpt}}

## Related Memories Already in LTM (up to 3)
{{#each related_memories}}
[{{index}}] ID={{id}} | Stability={{stability}} | Text: {{text}}
{{/each}}
{{#if no_related_memories}}(none found){{/if}}

Classify this observation.
```

#### Structured output schema

```typescript
export interface AmygdalaScoringResult {
  action: 'insert' | 'relate' | 'skip';
  targetId?: string;
  edgeType?: 'supersedes' | 'elaborates' | 'contradicts';
  reasoning: string; // max 120 chars, for audit only
  importanceScore: number; // 0.0–1.0
}
```

If the LLM returns `action: 'relate'` without a `targetId`, the entry is treated as `insert`.

#### Retry contract

- Max retries: 2
- Backoff: 500ms, 2000ms
- On all retries exhausted: mark STM entry `importance_scoring_failed`; entry remains unprocessed and rejoins the next cycle's batch
- After 3 consecutive cycles with `importance_scoring_failed`: mark `permanently_skipped`; log warning; exclude from future processing
- Structured response parse failure counts as a failure; no retry with relaxed schema

#### Cost guard

```typescript
export interface CostGuardOptions {
  maxLLMCallsPerHour: number; // default: 200
  lowCostModeThreshold: number; // default: 150
}
```

**Low-cost mode degradation ladder (activated when calls/hour > 150):**

1. Skip context file excerpt from prompt (~60 tok/entry saved)
2. Reduce related memories from 3 to 1 (~80 tok/entry saved)
3. Batch entries into a single prompt with a list (10x call-count reduction — biggest saving)
4. Skip hippocampus clusters with stability > 0.8
5. Defer entire hippocampus cycle to next schedule

When calls/hour > 200: halt all LLM calls for remainder of the hour window; mark entries `llm_rate_limited`; retry next hour.

---

### 5. Hippocampus LLM Integration

**Biological rationale:** Sleep consolidation is lossy-but-structured. It preserves gist, discards episodic detail, and treats inconsistencies as uncertainties rather than resolving them. The `confidence` field makes the fidelity of each consolidation explicit — low-confidence summaries decay faster without any special-case deletion logic.

#### System prompt (fixed at adapter init)

```
You are a memory consolidation engine for an AI agent.
You receive a cluster of related episodic memories and produce a single semantic summary.

Rules:
1. Preserve gist, discard episodic detail (who said it, when, exact wording).
2. If facts across episodes are consistent, state them confidently.
3. If facts conflict or seem uncertain, list them in uncertainties — do not fabricate resolution.
4. preservedFacts must be atomic, independently verifiable claims.
5. confidence reflects how consistent and reliable the source episodes are:
   - 0.9–1.0: All episodes agree, high signal.
   - 0.6–0.8: Mostly consistent, minor variation.
   - 0.3–0.5: Notable conflicts or gaps.
   - 0.0–0.2: Contradictory or too sparse to trust.
6. The summary must be one paragraph, max 3 sentences.
```

#### User turn template

```
## Episodic Cluster ({{record_count}} records)

{{#each records}}
--- Episode {{index}} ---
Recorded: {{timestamp_iso}}
Stability: {{stability}}
Content: {{text}}
{{/each}}

Consolidate these episodes into a single semantic memory.
Flag any inconsistencies in the uncertainties field.
```

#### Structured output schema

```typescript
export interface ConsolidationResult {
  summary: string; // max 3 sentences
  confidence: number; // 0.0–1.0
  preservedFacts: string[]; // atomic claims traceable to source episodes
  uncertainties: string[]; // inferred or conflicting claims
}
```

Minimum cluster size before an LLM call: 3 records. Clusters below this threshold are silently skipped.

#### Retry contract

- Max retries: 1
- Backoff: 1000ms
- On retry exhausted: skip the cluster for this cycle; source records remain untouched
- If `confidence < 0.3`: do NOT skip — pass to `ltm.consolidate()` with the confidence value; the stability formula handles the consequence naturally
- If the entire consolidation pass fails: do not call `ltm.prune()`; this is a pre-existing spec requirement

---

### 6. Confidence & False Memory Guardrails

**Biological rationale:** Humans surface memory uncertainty through hedging ("I think...", "I'm not sure but..."). Confidence is a first-class field, not a silent quality issue. Low-confidence consolidated memories are not blocked — they are real memories that simply decay faster, exactly as uncertain human memories do.

#### Confidence propagation chain

```
LLM returns { summary, confidence, preservedFacts, uncertainties }
  ↓
hippocampus passes all fields to ltm.consolidate(sourceIds, summary, { confidence, preservedFacts, uncertainties })
  ↓
consolidate() computes:
  stabilityMultiplier = 1.0 + (confidence × 0.5)   // range: 1.0 to 1.5
  stability = max(source stabilities) × stabilityMultiplier
  ↓
stores { confidence, preservedFacts, uncertainties } in metadata on the semantic record
  ↓
query() promotes metadata.confidence to top-level confidence field on LtmQueryResult
  ↓
caller reads confidence on query result; may hedge when confidence < 0.5
```

#### Effect on `consolidate()` options

```typescript
interface ConsolidateOptions {
  deflateSourceStability?: boolean;
  confidence?: number; // 0.0–1.0, defaults to 1.0
  preservedFacts?: string[];
  uncertainties?: string[];
}
```

At `confidence = 1.0`: behavior is unchanged from the current `×1.5` multiplier.
At `confidence = 0.0`: multiplier is `×1.0`; semantic record starts at max source stability and decays faster.

#### Schema additions to semantic record metadata

```typescript
{
  tier: 'semantic',
  confidence: number,
  preservedFacts: string[],
  uncertainties: string[],
  consolidatedAt: string,
  sourceIds: number[],
}
```

#### Caller interpretation contract

- `confidence >= 0.8`: high-fidelity; act normally
- `0.5 <= confidence < 0.8`: moderate; agent may hedge or verify
- `confidence < 0.5`: low-fidelity; treat as a hint; check `metadata.uncertainties`

The agent is never blocked by confidence. The signal is advisory — exactly like a human thinking "I'm pretty sure that happened but I might be misremembering."

---

### 7. SQLite Integrity (WAL + Transactions)

**Biological rationale:** Human memory is not corrupted by being interrupted mid-consolidation — the brain does not half-apply a memory update. WAL mode + transaction boundaries give the same guarantee: consolidation either fully completes or fully rolls back.

#### WAL mode (required)

```typescript
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
```

WAL allows concurrent readers while a write transaction is open. This is required for the amygdala/hippocampus concurrency model: the amygdala reads LTM during scoring while hippocampus may be consolidating.

#### Transaction boundary map

| Operation                       | Transactional | Reason                                                                                           |
| ------------------------------- | ------------- | ------------------------------------------------------------------------------------------------ |
| `insert()` single record        | No            | Single-statement write; atomic by SQLite default                                                 |
| `bulkInsert([])`                | Yes           | All-or-nothing per existing spec requirement                                                     |
| `relate()` single edge          | No            | Single insert; atomic                                                                            |
| `consolidate()` full pass       | Yes           | Creates semantic record + N edges + deflates N source stabilities; partial write = corrupt state |
| `prune()`                       | Yes           | Deletes M records + tombstones + edge cascades; partial = dangling edges                         |
| `delete()` single record        | Yes           | Record delete + edge cascade must be atomic                                                      |
| `update()` metadata patch       | No            | Single row update; atomic                                                                        |
| `findConsolidationCandidates()` | No            | Read-only                                                                                        |
| `query()`                       | No            | Read-only; WAL ensures snapshot consistency                                                      |

#### Crash recovery guarantee

SQLite with WAL mode guarantees: if the process dies mid-transaction, on next open the WAL file is rolled back and the database is in the state of the last committed transaction. No application-level recovery logic is needed for the SQLite layer. The spec must state this explicitly so implementers do not add unnecessary recovery code.

---

### 8. Mutual Exclusion

**Biological rationale:** The amygdala and hippocampus are competing consolidation processes. In the human brain they do not run simultaneously — the hippocampus primarily consolidates during sleep when the amygdala is less active. The lock table enforces this serial relationship.

#### process_locks table schema

```sql
CREATE TABLE IF NOT EXISTS process_locks (
  process     TEXT PRIMARY KEY,
  acquired_at INTEGER NOT NULL,   -- Unix ms
  ttl_ms      INTEGER NOT NULL    -- stale detection threshold
);
```

#### Lock TTL values

- Amygdala: `cadenceMs × 2`
- Hippocampus: `scheduleMs × 2`

#### Acquisition semantics

`acquireLock(process, ttlMs): boolean`

1. Check for a competing process's row in `process_locks`
2. If row exists and `now < acquired_at + ttl_ms`: return `false` (live lock held)
3. If row exists and `now >= acquired_at + ttl_ms`: delete stale row (crash recovery)
4. Insert own row with `acquired_at = now`, `ttl_ms = ttl_ms`: return `true`

All steps execute inside a single `db.transaction()` call.

`releaseLock(process): void` — always called in a `finally` block; deletes own row.

#### Behavior on failed acquisition

- Amygdala: defer current cycle; log warning; retry at next scheduled time
- Hippocampus: skip entire consolidation pass for this cycle; no partial writes

#### Why not BEGIN EXCLUSIVE at the file level

SQLite's file-level exclusive lock blocks all readers, including amygdala's LTM queries during the hippocampus pass. WAL mode allows concurrent reads with one writer, but the writer lock is per-connection and per-statement — it does not span the full consolidation pass. The `process_locks` table provides application-level mutual exclusion without sacrificing read concurrency.

---

### 9. Episodic Tombstoning

**Biological rationale:** A human's episodic memory of a specific event fades, but the semantic memory derived from it persists. If asked, the human can confirm "I remember something from that time but the specifics are gone." A tombstoned record represents exactly this state — the trace persists; the content is gone.

#### Schema changes

```sql
ALTER TABLE records ADD COLUMN tombstoned     INTEGER DEFAULT 0;  -- 0 = live, 1 = tombstoned
ALTER TABLE records ADD COLUMN tombstoned_at  INTEGER;            -- Unix ms, null if live
```

#### Pruning behavior

When `prune()` removes an episodic record that is referenced as a `toId` by any `consolidates` edge:

```sql
UPDATE records
  SET tombstoned = 1, tombstoned_at = ?, data = NULL, embedding = NULL
  WHERE id = ?
```

Edges on tombstoned records are still deleted — the semantic → episodic `consolidates` edge is no longer needed once the source is tombstoned.

Episodic records with no `consolidates` back-reference are fully deleted (behavior unchanged).

#### Caller-visible contract

```typescript
interface TombstonedRecord {
  id: number;
  tombstoned: true;
  tombstonedAt: Date;
  data: null;
}
```

- `getById(id)` for a tombstoned record returns `{ id, tombstoned: true, tombstonedAt, data: null }` — not `null` — so the caller can distinguish "never existed" from "faded from memory"
- `query()` excludes tombstoned records from scoring (no embedding; nothing to score against)
- `getStats()` includes a `tombstoned` counter alongside `episodic` and `semantic`

The semantic record's `metadata.preservedFacts` and `metadata.uncertainties` serve as the audit trail once episodics are tombstoned.

---

### 10. Context File Lifecycle

**Biological rationale:** Experience that has been integrated into long-term memory no longer needs to remain in the short-term buffer. Context files are the raw sensory input; once processed, retaining them has no memory value — they just occupy space.

#### Storage path convention

```
<db-dir>/context/<session-id>/<phase-id>.ctx
```

`contextDir` is configurable in `MemoryConfig`; default is `<db-dir>/context/`. The `sessionId` subdirectory isolates files across restarts, enabling orphan detection during startup.

#### Deletion trigger

A context file is safe to delete when its linked STM insight is marked `processed` by amygdala — regardless of the action taken (`insert`, `relate`, or `skip`). The rule is uniform: `processed = true` → `safeToDelete = true`.

#### Ownership

- **Amygdala**: after marking an STM entry `processed`, sets `safeToDelete = true` on the context file record. Does NOT delete the file (no disk I/O in the hot cycle).
- **Hippocampus**: after `ltm.prune()` completes in its pruning pass, deletes all context files marked `safeToDelete = true`. Deletion errors are non-fatal and counted in `HippocampusConsolidationEndPayload.contextFilesDeleted`.

#### pruneContextFiles() API

```typescript
interface PruneContextFilesOptions {
  olderThanDays: number;
}

interface PruneContextFilesReport {
  deletedCount: number;
  deletedBytes: number;
  skippedCount: number; // files not yet safe to delete
  errors: Array<{ path: string; error: string }>;
}

interface Memory {
  pruneContextFiles(options: PruneContextFilesOptions): Promise<PruneContextFilesReport>;
}
```

Files whose insight is still pending are never deleted regardless of age.

---

### 11. Observability: getStats() and Events

**Biological rationale:** A brain clinician monitors metabolic activity, decay rates, and consolidation cycles to assess brain health. `getStats()` and the event catalog provide the equivalent diagnostic surface — without these, the background processes are invisible black boxes.

#### Full MemoryStats interface

```typescript
interface LtmStats {
  totalRecords: number;
  episodicCount: number;
  semanticCount: number;
  tombstonedCount: number;
  averageRetention: number;
  belowThresholdCount: number; // retention < 0.2, approaching prune
  totalEdges: number;
  averageEdgeRetention: number;
}

interface StmStats {
  pendingInsights: number;
  averageInsightAgeMs: number;
  oldestInsightAgeMs: number;
}

interface AmygdalaStats {
  lastCycleStartedAt: Date | null;
  lastCycleDurationMs: number | null;
  lastCycleInsightsProcessed: number;
  lastCycleFailures: number;
  sessionTotalLlmCalls: number;
  sessionEstimatedTokens: number;
}

interface HippocampusStats {
  lastConsolidationAt: Date | null;
  lastRunClustersConsolidated: number;
  lastRunRecordsPruned: number;
  falseMemoryCandidates: number; // semantic records with confidence < 0.5
  nextScheduledRunAt: Date | null;
}

interface DiskStats {
  contextFilesOnDisk: number;
  contextTotalBytes: number;
  oldestContextFileAgeMs: number | null;
  contextDir: string;
}

interface MemoryStats {
  capturedAt: Date;
  sessionId: string;
  ltm: LtmStats;
  stm: StmStats;
  amygdala: AmygdalaStats;
  hippocampus: HippocampusStats;
  disk: DiskStats;
}
```

`falseMemoryCandidates` counts semantic records with `metadata.confidence < 0.5`.

#### Full MemoryEvents catalog

```typescript
type RelationEdgeType = 'supersedes' | 'elaborates' | 'contradicts';
type AmygdalaAction = 'insert' | 'relate' | 'skip';

interface AmygdalaCycleStartPayload {
  cycleId: string;
  pendingCount: number;
  startedAt: Date;
}

interface AmygdalaCycleEndPayload {
  cycleId: string;
  durationMs: number;
  processed: number;
  failures: number;
  llmCalls: number;
  estimatedTokens: number;
}

interface AmygdalaEntryScoredPayload {
  insightId: string;
  action: AmygdalaAction;
  importanceScore: number;
  relatedToId?: number;
  edgeType?: RelationEdgeType;
}

interface HippocampusConsolidationStartPayload {
  runId: string;
  startedAt: Date;
}

interface HippocampusConsolidationEndPayload {
  runId: string;
  durationMs: number;
  clustersConsolidated: number;
  recordsPruned: number;
  contextFilesDeleted: number;
}

interface HippocampusFalseMemoryRiskPayload {
  recordId: number;
  confidence: number; // < 0.5
  sourceIds: number[];
}

interface LtmRecordDecayedBelowThresholdPayload {
  recordId: number;
  retention: number; // < 0.2
  stability: number;
  lastAccessedAt: Date;
}

interface LtmPruneExecutedPayload {
  removedCount: number;
  removedIds: number[];
}

interface StmCompressionTriggeredPayload {
  contextUsagePercent: number;
  tokenCount: number;
  maxTokens: number;
  phaseId: string;
}

interface MemoryEvents {
  'amygdala:cycle:start': AmygdalaCycleStartPayload;
  'amygdala:cycle:end': AmygdalaCycleEndPayload;
  'amygdala:entry:scored': AmygdalaEntryScoredPayload;
  'hippocampus:consolidation:start': HippocampusConsolidationStartPayload;
  'hippocampus:consolidation:end': HippocampusConsolidationEndPayload;
  'hippocampus:false-memory-risk': HippocampusFalseMemoryRiskPayload;
  'ltm:record:decayed-below-threshold': LtmRecordDecayedBelowThresholdPayload;
  'ltm:prune:executed': LtmPruneExecutedPayload;
  'stm:compression:triggered': StmCompressionTriggeredPayload;
}
```

`ltm:record:decayed-below-threshold` is emitted lazily during `query()` when decay is computed and a record crosses the 0.2 boundary — not via a polling loop. This is biologically faithful: the decay signal surfaces when the memory is next touched, not on a clock.

The event emitter is a typed wrapper around Node.js `EventEmitter` exposed as `memory.events`. Multiple independent consumers (logging, metrics, tests) can attach without coordination.

---

### 12. Shutdown & Startup Sequences

**Biological rationale:** Sleep consolidation is a deliberate, ordered process — the brain does not simply shut off. The shutdown sequence mirrors this: flush working memory, run a final consolidation pass, then close the store.

#### Ordered shutdown steps

1. Gate new writes — set internal `isShuttingDown` flag; subsequent `logInsight()` throws `ShutdownError`
2. Flush STM compression — compress all remaining uncompressed phases in chronological order
3. Final amygdala pass — drain all pending STM entries through one synchronous scoring cycle
4. Wait for hippocampus — if a consolidation cycle is in progress, wait for it to complete naturally; if not running, skip
5. Close SQLite — flush WAL, close `better-sqlite3` connection
6. Return `ShutdownReport`

```typescript
interface ShutdownReport {
  sessionId: string;
  shutdownAt: Date;
  durationMs: number;
  stmPhasesCompressed: number;
  insightsDrained: number;
  hippocampusCycleWaitedMs: number | null;
  ltmRecordsAtClose: number;
  contextFilesRemainingOnDisk: number;
}

interface Memory {
  shutdown(): Promise<ShutdownReport>;
}
```

`shutdown()` does not prune context files — it reports how many remain so the caller can decide. Pruning at shutdown would extend the window unpredictably for long-lived agents.

#### Startup sequence

1. Validate `MemoryConfig` — throw immediately on missing/invalid config (fail fast)
2. Run DB migrations — `ltmAdapter.migrate()`; no-op if schema is current
3. Recover orphaned amygdala jobs — query for STM entries that are `processed = false` but whose `contextFile` no longer exists on disk; mark `importance_scoring_failed`; they rejoin the first amygdala cycle
4. Assign `sessionId` — new UUID for this session
5. Ensure context directory exists — create `<contextDir>/<sessionId>/` if absent
6. Instantiate subsystems — `LtmEngine`, `InsightLog`, `ContextManager`, `AmygdalaProcess`, `HippocampusProcess` wired with the shared `MemoryEventEmitter`
7. Start background processes — amygdala timer/threshold watcher; hippocampus schedule
8. Capture and return startup stats

```typescript
interface CreateMemoryResult {
  memory: Memory;
  startupStats: MemoryStats;
}

function createMemory(config: MemoryConfig): Promise<CreateMemoryResult>;
```

The return type changes from `Memory` to `CreateMemoryResult`. This is a breaking change. The rationale: the caller must always know what state was inherited, especially on restart after a crash. Startup stats also let the caller decide immediately whether to `pruneContextFiles()` if disk usage is high.

---

### 13. FTS5 / sqlite-vec Strategy

**Biological rationale:** Keyword retrieval (BM25) maps to the brain's phonological loop — "what were the exact words?" — a distinct recall pathway from semantic similarity. It is a real human signal, but less critical than semantic and temporal cues at agent scale in v1.

#### v1: Create FTS5 table, do not activate BM25

```sql
CREATE VIRTUAL TABLE ltm_records_fts USING fts5(
  data,
  content='ltm_records',
  content_rowid='id'
);
```

Content-mode FTS5 stores no data (zero storage cost). The `insertRecord` operation triggers FTS5 index update. BM25 scoring is NOT wired into the retrieval pipeline in v1.

Rationale: creates the table now to avoid painful schema migration when BM25 is activated in v2. No retrieval behavior changes.

#### v2: Activate BM25 as Strategy 4 in the RRF pipeline

When activated, `bm25(ltm_records_fts)` provides a fourth ranked list fed into `rrfMerge`. No API surface changes; only the internal query function changes.

#### sqlite-vec: explicitly deferred

The existing design's decision to defer ANN indexing stands. At agent scale (< 50k records), brute-force cosine over 384-dim vectors in JS is < 10ms — acceptable for async paths. `sqlite-vec` requires native SQLite extension binding config, HNSW index rebuilds after bulk inserts, and adds build complexity. The `StorageAdapter` interface already provides the escape hatch: swap `SqliteAdapter` internals in v2 when record count exceeds 20k as a measurable threshold.

---

## Package Structure Changes

A new `@neurokit/llm` package is required. Rationale: both `@neurokit/amygdala` and `@neurokit/hippocampus` depend on the same `LLMAdapter` interface. Co-locating it in either package creates a circular or forced dependency. A shared package prevents interface drift and enables a single adapter instance to be shared between both processes.

```
packages/
  ltm/          @neurokit/ltm     — existing; adds EmbeddingAdapter, RRF merge, FTS5 table, process_locks table, tombstoning, WAL
  stm/          @neurokit/stm     — existing; adds session-scoped context path
  amygdala/     @neurokit/amygdala — existing; adds LLMAdapter injection, full prompt spec, retry contract, cost guard
  hippocampus/  @neurokit/hippocampus — existing; adds LLMAdapter injection, full prompt spec, confidence passthrough, lock acquisition
  memory/       @neurokit/memory  — existing; adds createMemory() → { memory, startupStats }, getStats(), shutdown(), pruneContextFiles(), events
  llm/          @neurokit/llm     — NEW; LLMAdapter interface, AnthropicAdapter, OpenAICompatibleAdapter
```

---

## V1 vs V2 Scope

| Capability                                 | V1            | V2                |
| ------------------------------------------ | ------------- | ----------------- |
| EmbeddingAdapter interface                 | Ships         | —                 |
| TransformersJsAdapter (default)            | Ships         | —                 |
| OpenAIEmbeddingAdapter                     | Ships         | —                 |
| EmbeddingMeta on records                   | Ships         | —                 |
| Model mismatch detection                   | Ships         | —                 |
| reembedAll migration utility               | Ships         | —                 |
| Semantic cosine strategy                   | Ships         | —                 |
| Temporal-weighted strategy                 | Ships         | —                 |
| One-hop graph traversal strategy           | Ships         | —                 |
| RRF merge (3 strategies)                   | Ships         | —                 |
| BM25/FTS5 Strategy 4                       | —             | V2                |
| FTS5 table creation                        | Ships (no-op) | —                 |
| Cross-encoder reranking                    | —             | V2                |
| sqlite-vec ANN indexing                    | —             | V2 (>20k records) |
| LLMAdapter interface + AnthropicAdapter    | Ships         | —                 |
| OpenAICompatibleAdapter                    | Ships         | —                 |
| @neurokit/llm package                      | Ships         | —                 |
| Amygdala full prompt spec + retry          | Ships         | —                 |
| Hippocampus full prompt spec + retry       | Ships         | —                 |
| Cost guard (150/200 calls/hour)            | Ships         | —                 |
| Confidence field on ConsolidationResult    | Ships         | —                 |
| Confidence-adjusted stability formula      | Ships         | —                 |
| preservedFacts / uncertainties in metadata | Ships         | —                 |
| WAL mode + transaction boundaries          | Ships         | —                 |
| process_locks table + TTL recovery         | Ships         | —                 |
| Episodic tombstoning                       | Ships         | —                 |
| Context file session-scoped path           | Ships         | —                 |
| Amygdala marks safeToDelete                | Ships         | —                 |
| Hippocampus deletes context files          | Ships         | —                 |
| pruneContextFiles() API                    | Ships         | —                 |
| getStats() + MemoryStats                   | Ships         | —                 |
| MemoryEvents catalog + typed emitter       | Ships         | —                 |
| Ordered shutdown + ShutdownReport          | Ships         | —                 |
| createMemory() → { memory, startupStats }  | Ships         | —                 |
| Orphan recovery on startup                 | Ships         | —                 |

---

## Spec Changes Summary

### `packages/ltm/openspec/.../specs/ltm-storage/spec.md`

- Add: Every `LtmRecord` MUST include `embeddingMeta: { modelId: string; dimensions: number }`
- Add: `SqliteAdapter` schema MUST include `embedding_model_id TEXT NOT NULL`, `embedding_dimensions INTEGER NOT NULL`
- Add: `SqliteAdapter` MUST enable WAL mode (`journal_mode = WAL`, `synchronous = NORMAL`) at connection time
- Add: `SqliteAdapter` MUST create `process_locks` table; expose `acquireLock(process, ttlMs): boolean` and `releaseLock(process): void`
- Add: `SqliteAdapter` MUST create `ltm_records_fts` FTS5 content virtual table during schema init; `insertRecord` MUST trigger FTS5 update
- Add: `records` table MUST include `tombstoned INTEGER DEFAULT 0` and `tombstoned_at INTEGER` columns
- Add: `bulkInsert()`, `delete()`, `consolidate()`, and `prune()` MUST execute inside explicit SQLite transactions
- Add: `getById()` MUST return tombstoned records as `{ id, tombstoned: true, tombstonedAt, data: null }` rather than `null`
- Add: `query()` MUST exclude tombstoned records from scoring
- Add: `StorageAdapter` interface MUST expose `updateEmbedding(id, embedding, meta)` as distinct from `updateMetadata`
- Add: `StorageAdapter` interface MUST expose `getAllRecords()` to support brute-force cosine scan

### `packages/ltm/openspec/.../specs/ltm-query/spec.md`

- Add: `queryLtm` MUST embed the query string via injected `EmbeddingAdapter`
- Add: `queryLtm` MUST run three strategies (semantic cosine, temporal-weighted, one-hop graph traversal) in parallel and merge with RRF (`K=60`)
- Add: `queryLtm` MUST detect `adapter.modelId` mismatch against stored `embeddingMeta.modelId` and return `EMBEDDING_MODEL_MISMATCH` error immediately
- Add: `queryLtm` MUST apply graduated strengthening post-merge; graph-traversal additions get 50% of the growth factor of direct semantic hits
- Add: `LtmQueryResult` MUST include `retrievalStrategies: ('semantic' | 'temporal' | 'associative')[]` and `rrfScore: number`
- Add: `LtmQueryResult` MUST include `confidence?: number` promoted from `metadata.confidence` for `tier === 'semantic'` records
- Add: `query()` MUST emit `ltm:record:decayed-below-threshold` lazily when a record crosses `retention < 0.2` during score computation

### `packages/ltm/openspec/.../specs/ltm-embedding/spec.md` (new spec)

- `EmbeddingAdapter` interface: `modelId`, `dimensions`, `embed(text): ResultAsync<EmbedResult, EmbedError>`
- `TransformersJsAdapter`: `Xenova/all-MiniLM-L6-v2`, 384-dim, local inference, default adapter
- `OpenAIEmbeddingAdapter`: `text-embedding-3-small`, 1536-dim, requires `apiKey`
- `reembedAll(adapter, storage): ResultAsync<{ reembedded: number }, ReembedError>` — migration utility; consumer-driven; never runs automatically

### `packages/ltm/openspec/.../specs/ltm-consolidation/spec.md`

- Add: `consolidate()` MUST accept `confidence?: number` (default `1.0`), `preservedFacts?: string[]`, `uncertainties?: string[]` in options
- Add: Initial stability of semantic record MUST be `max(source stabilities) × (1.0 + confidence × 0.5)`
- Add: `confidence`, `preservedFacts`, `uncertainties` MUST be stored in `metadata` on the semantic record
- Add: When `prune()` removes an episodic record referenced by a `consolidates` edge, it MUST tombstone (`data = null`, `embedding = null`, `tombstoned = 1`) rather than delete

### `packages/stm/openspec/.../specs/stm-compression/spec.md`

- Add: Context file path MUST be `<contextDir>/<sessionId>/<phaseId>.ctx`
- Add: `contextDir` MUST default to `<db-dir>/context/`
- Add: STM compressor MUST NOT delete context files; lifecycle is owned by amygdala (marking) and hippocampus (deletion)

### `packages/amygdala/openspec/.../specs/amygdala-scoring/spec.md`

- Add: Amygdala MUST accept an `LLMAdapter` instance at construction; MUST NOT instantiate a specific LLM client internally
- Add: LLM call MUST use `completeStructured` with the `AmygdalaScoringResult` schema (action, targetId, edgeType, reasoning, importanceScore)
- Add: If LLM returns `relate` without `targetId`, entry MUST be treated as `insert`
- Add: Retry contract: max 2 retries, backoff 500ms/2000ms; on exhaustion mark `importance_scoring_failed`; after 3 consecutive cycles mark `permanently_skipped`
- Add: Cost guard: track calls/hour; low-cost mode at 150; halt at 200; mark `llm_rate_limited`
- Add: After marking STM entry `processed`, amygdala MUST set `safeToDelete = true` on the context file record; MUST NOT delete the file
- Add: Amygdala MUST emit `amygdala:cycle:start`, `amygdala:cycle:end`, `amygdala:entry:scored` events
- Add: Amygdala MUST acquire `process_locks` entry before any LTM write batch; MUST release in `finally` block
- Add: Default model MUST be `claude-haiku-3-5` or equivalent low-cost model

### `packages/hippocampus/openspec/.../specs/hippocampus-consolidation/spec.md`

- Add: Hippocampus MUST accept an `LLMAdapter` instance at construction
- Add: LLM call MUST use `completeStructured` with `ConsolidationResult` schema (summary, confidence, preservedFacts, uncertainties)
- Add: Minimum cluster size for LLM call: 3 records; smaller clusters MUST be silently skipped
- Add: `confidence` from LLM response MUST be passed to `ltm.consolidate()` as `options.confidence`; hippocampus MUST NOT interpret or act on it beyond forwarding
- Add: Retry contract: max 1 retry, backoff 1000ms; on exhaustion skip cluster for this cycle; source records remain untouched
- Add: Hippocampus MUST acquire `process_locks` entry before beginning consolidation pass; MUST release in `finally` block
- Add: After `ltm.prune()` completes, hippocampus MUST delete all context files marked `safeToDelete = true`; deletion errors MUST be non-fatal
- Add: Hippocampus MUST emit `hippocampus:consolidation:start`, `hippocampus:consolidation:end` events; MUST emit `hippocampus:false-memory-risk` for each consolidated record with `confidence < 0.5`
- Add: Cost guard: hippocampus MUST respect `maxLLMCallsPerHour`; defer entire cycle if budget exhausted

### `packages/memory/openspec/.../specs/memory-orchestration/spec.md`

- Add: `createMemory(config)` MUST return `{ memory, startupStats }` — breaking change from implied bare `Memory` return
- Add: Startup sequence MUST include orphan recovery: detect `processed = false` STM entries with missing context files; mark `importance_scoring_failed`
- Add: `memory.shutdown()` MUST execute the ordered shutdown sequence and return `ShutdownReport`
- Add: After `shutdown()` is called, any subsequent `logInsight()` call MUST throw `ShutdownError`
- Add: `memory.getStats()` MUST return `MemoryStats` as specified; callable at any time including during shutdown
- Add: `memory.pruneContextFiles({ olderThanDays })` MUST delete `safeToDelete = true` files older than the threshold; MUST NOT delete pending files regardless of age; MUST return `PruneContextFilesReport`
- Add: `memory.events` MUST be a typed `MemoryEventEmitter` emitting all events in the `MemoryEvents` catalog
