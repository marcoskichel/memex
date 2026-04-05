# Memex Specification

## Abstract

Memex is a biologically-inspired agent memory SDK for TypeScript. It provides a layered memory architecture — short-term, long-term, episodic, and semantic — modelled on human cognitive memory systems. Agents log observations into a short-term insight log; an asynchronous importance-scoring component (the amygdala) gates promotion to persistent long-term memory; a consolidation component (the hippocampus) clusters related episodics into semantic generalizations; and a public orchestrator (Memory) exposes the full pipeline behind a minimal interface.

The name Memex is drawn from Vannevar Bush's 1945 essay "As We May Think," in which he described a hypothetical memory-extension device that would allow a person to store and retrieve all books, records, and communications as an augmented associative trail — a precursor to hypertext and personal knowledge management. This SDK is a software realisation of that vision for autonomous agents.

---

## Status of This Document

This document is a working specification for the Memex SDK. It is normative for all conforming implementations.

---

## 1. Notational Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in RFC 2119.

Type definitions use TypeScript interface notation. Field names in `monospace` refer to TypeScript identifiers or SQL column names. Package names use the `@memex/*` namespace.

---

## 2. Terminology

**Working memory** — The LLM's active context window. Not a package. Managed externally by the agent runtime.

**STM (Short-Term Memory)** — The `InsightLog` from `@memex/stm`. A transient in-process append-only log of insight entries. Entries are pending until processed by the amygdala.

**LTM (Long-Term Memory)** — The `LtmEngine` and its backing `StorageAdapter` from `@memex/ltm`. A persistent vector store backed by SQLite. Contains episodic and semantic records.

**Insight Entry** — A single unit of observation appended to the STM. Contains a text summary, a path to a context file, and optional agent-supplied tags.

**LTM Record** — A persisted memory record. Has a tier (episodic or semantic), an embedding vector, an importance score, a stability score, and associated metadata.

**Episodic memory** — Records of what happened during a session. Produced by amygdala-gated STM promotion. Subject to temporal decay and consolidation.

**Semantic memory** — Generalized facts inferred from recurring episodics. Produced by hippocampus consolidation or by direct semantic seeding. High confidence. Not subject to the same decay profile as episodics.

**Procedural memory** — Behavioral rules governing how an agent acts. Not implemented in this SDK. MUST be managed by the consumer and injected into the system prompt externally.

**Amygdala** — The `AmygdalaProcess` from `@memex/amygdala`. An asynchronous background process that scores STM entries for importance and gates their promotion to LTM.

**Hippocampus** — The `HippocampusProcess` from `@memex/hippocampus`. A scheduled background process that clusters related episodics and consolidates them into semantic records.

**Memory** — The `Memory` interface from `@memex/memory`. The public orchestrator that agent code interacts with directly.

**Session** — A single continuous invocation of an agent. Identified by a `sessionId` string. All LTM records written during a session carry this identifier.

**Stability** — A per-record scalar (in days) representing how long the record is expected to persist before decaying below retrieval threshold. Starts at `1 + importance * 9` days.

**Retention** — A computed value `exp(-ageDays / stability)`. Represents the current strength of a memory. Records with retention below `0.1` are pruned.

**Effective score** — `cosine_similarity * retention`. The composite retrieval score for a candidate record.

**RRF (Reciprocal Rank Fusion)** — A score fusion algorithm combining ranked lists from multiple retrieval strategies. RRF constant `k = 60`.

---

## 3. Architecture Overview

### 3.1 Biological Analogy

| Memex Component              | Biological Analog           | Role                                                     |
| ---------------------------- | --------------------------- | -------------------------------------------------------- |
| Working memory (LLM context) | Prefrontal cortex           | Active reasoning and attention                           |
| STM / InsightLog             | Hippocampal encoding buffer | Short-lived observations before consolidation            |
| Amygdala                     | Amygdala                    | Emotional salience gating; importance scoring            |
| LTM / LtmEngine              | Neocortex                   | Durable long-term storage                                |
| Hippocampus                  | Hippocampus                 | Sleep-phase consolidation; episodic-to-semantic transfer |

### 3.2 Component Diagram

```
  Agent Code
      |
      v
  +---------+
  |  Memory |  <-- @memex/memory (public interface)
  +---------+
      |       \
      |        \-- recall() --> LtmEngine --> StorageAdapter (SQLite)
      |
      +--> logInsight()
               |
               v
          +----------+
          | InsightLog|  (@memex/stm)
          +----------+
               |
               v  (async, every 5 min or when STM >= 10 entries)
          +-----------+
          | Amygdala  |  (@memex/amygdala)
          | Process   |
          +-----------+
               |
               |-- LLM importance scoring
               |-- action: insert / relate / skip
               |
               v
          +----------+
          | LtmEngine|  (@memex/ltm)
          +----------+
               |
               v  (scheduled, default every 1 hour)
          +------------+
          | Hippocampus|  (@memex/hippocampus)
          | Process    |
          +------------+
               |
               |-- cluster episodics by cosine similarity
               |-- LLM consolidation -> semantic record
               |-- prune decayed records
               |
               v
          +----------+
          | LtmEngine|  (@memex/ltm)
          +----------+
```

### 3.3 Data Flow

**Ingestion path:**

```
logInsight(summary, contextFile, tags)
  --> InsightLog.append()
  --> [async] AmygdalaProcess.run()
      --> selectBatch() from unprocessed entries
      --> fetchRelatedMemories() via LtmEngine.query()
      --> LLM: score observation (importance, action)
      --> applyAction():
          insert  --> LtmEngine.insert() [episodic or semantic]
          relate  --> LtmEngine.insert() + LtmEngine.relate()
          skip    --> markProcessed only
      --> InsightLog.markProcessed()
      --> mark contextFile safeToDelete = true
```

**Consolidation path:**

```
[scheduled] HippocampusProcess.run()
  --> LtmEngine.findConsolidationCandidates()
      --> cluster episodics by cosine similarity >= 0.85
      --> apply temporal proximity constraint (default 30 days)
  --> for each eligible cluster:
      --> LLM: consolidate into semantic summary
      --> LtmEngine.consolidate() [creates semantic record, deflates source stability]
  --> LtmEngine.prune() [hard-delete records with retention < 0.1]
  --> delete contextFiles with safeToDelete = true
```

**Retrieval path:**

```
recall(nlQuery, options)
  --> embed(nlQuery)
  --> filter candidates (tier, sessionId, category, date range)
  --> score: cosine similarity, temporal (sim * retention), associative (graph traversal)
  --> RRF merge of three ranked lists
  --> threshold filter (default 0.5 effective score)
  --> optionally strengthen retrieved records
  --> return LtmQueryResult[]
```

---

## 4. Memory Model

### 4.1 Memory Tiers

Memex defines two active memory tiers stored in LTM:

**Episodic** — Specific observations from agent sessions. Relatively transient. Decays over time via retention function. Subject to consolidation by the hippocampus. Produced by amygdala-gated STM promotion.

**Semantic** — Generalized, durable facts. Produced by hippocampus consolidation of episodic clusters, or by direct semantic seeding. Carries a `confidence` value in metadata. Not subject to the same decay dynamics as episodics.

A third tier, **procedural**, is intentionally out of scope for v1. Behavioral rules MUST be managed by the consumer and injected into the system prompt externally. The `Memory.recall()` and `createMemory()` interfaces do not provide procedural memory support.

### 4.2 Record Schema

```typescript
interface LtmRecord {
  id: number;
  data: string;
  metadata: Record<string, unknown>;
  embedding: Float32Array;
  embeddingMeta: EmbeddingMeta;
  tier: 'episodic' | 'semantic';
  importance: number;
  stability: number;
  lastAccessedAt: Date;
  accessCount: number;
  createdAt: Date;
  tombstoned: boolean;
  tombstonedAt: Date | undefined;

  // Schema extensions (ltm-schema-extensions)
  sessionId: string;
  category?: string;
  episodeSummary?: string;
}

interface EmbeddingMeta {
  modelId: string;
  dimensions: number;
}
```

**SQLite table: `records` (v1 schema)**

```sql
CREATE TABLE IF NOT EXISTS records (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  data                TEXT,
  metadata            TEXT NOT NULL DEFAULT '{}',
  embedding           BLOB,
  embedding_model_id  TEXT NOT NULL DEFAULT '',
  embedding_dimensions INTEGER NOT NULL DEFAULT 0,
  tier                TEXT NOT NULL DEFAULT 'episodic',
  importance          REAL NOT NULL DEFAULT 0,
  stability           REAL NOT NULL DEFAULT 1,
  last_accessed_at    INTEGER NOT NULL,
  access_count        INTEGER NOT NULL DEFAULT 0,
  created_at          INTEGER NOT NULL,
  tombstoned          INTEGER NOT NULL DEFAULT 0,
  tombstoned_at       INTEGER
);
```

**SQLite migration v2 (ltm-schema-extensions)**

```sql
ALTER TABLE records ADD COLUMN session_id TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE records ADD COLUMN category TEXT;
ALTER TABLE records ADD COLUMN episode_summary TEXT;

CREATE INDEX idx_ltm_session_tier_created
  ON records(session_id, tier, created_at);

CREATE INDEX idx_ltm_category ON records(category);
```

Records inserted before the v2 migration SHALL have `sessionId === 'legacy'`. Pre-migration records have `category === undefined` and `episodeSummary === undefined`.

**LTM Edge schema:**

```typescript
interface LtmEdge {
  id: number;
  fromId: number;
  toId: number;
  type: 'supersedes' | 'elaborates' | 'contradicts' | 'consolidates';
  stability: number;
  lastAccessedAt: Date;
  createdAt: Date;
}
```

### 4.3 Lifecycle: Working Memory to LTM

```
Working memory (LLM context)
  |
  | agent calls logInsight()
  v
STM (InsightLog) -- entries await amygdala processing
  |
  | AmygdalaProcess.run() [every cadenceMs, default 5 min]
  | or when STM length >= STM_THRESHOLD (10 entries)
  v
Importance scoring (LLM call)
  |
  |-- skip  --> entry marked processed, discarded
  |-- insert --> LtmEngine.insert() as episodic (or semantic if singleton-promoted)
  |-- relate --> LtmEngine.insert() + LtmEngine.relate()
  v
LTM (episodic records) -- subject to temporal decay
  |
  | HippocampusProcess.run() [every scheduleMs, default 1 hour]
  v
Consolidation (LLM call per cluster)
  |
  |--> semantic record created
  |--> source episodics have stability deflated
  v
LTM (semantic records) -- high confidence, durable
  |
  | prune() pass
  v
Tombstoned / deleted (retention < 0.1)
```

---

## 5. Components

### 5.1 LTM Store (`@memex/ltm`)

`@memex/ltm` provides `LtmEngine` and `StorageAdapter`. It is the only component with direct access to the SQLite database.

**Public interface:**

```typescript
class LtmEngine {
  insert(data: string, options?: LtmInsertOptions): Promise<number>;
  bulkInsert(entries: LtmBulkEntry[]): Promise<number[]>;
  update(id: number, patch: { metadata?: Record<string, unknown> }): boolean;
  delete(id: number): boolean;
  relate(params: RelateParams): number;
  getById(id: number): LtmRecord | TombstonedRecord | undefined;
  query(nlQuery: string, options?: LtmQueryOptions): ResultAsync<LtmQueryResult[], LtmQueryError>;
  findConsolidationCandidates(options?: FindConsolidationOptions): LtmRecord[][];
  consolidate(sourceIds: number[], request: ConsolidateRequest): Promise<number>;
  prune(options?: PruneOptions): { pruned: number; remaining: number };
  stats(): LtmEngineStats;
}
```

**Insert options:**

```typescript
interface LtmInsertOptions {
  importance?: number;
  metadata?: Record<string, unknown>;
  tier?: 'episodic' | 'semantic'; // default: 'episodic'
  sessionId?: string;
  category?: string;
  episodeSummary?: string;
}
```

When `tier: 'semantic'` is supplied on insert, `metadata.confidence` SHALL default to `1.0` if not provided. The library MUST NOT throw when `confidence` is absent.

**Query options:**

```typescript
interface LtmQueryOptions {
  limit?: number;
  threshold?: number;
  strengthen?: boolean;
  tier?: 'episodic' | 'semantic';
  minImportance?: number;
  after?: Date;
  before?: Date;
  minStability?: number;
  minAccessCount?: number;
  sort?: 'confidence' | 'recency' | 'stability' | 'importance';
  sessionId?: string; // schema extension
  category?: string; // schema extension
  tags?: string[]; // schema extension
}
```

`sessionId` and `category` filters, when present, SHALL be applied as SQL WHERE clauses before records are loaded into memory for embedding scoring. Both filters are AND-combined when supplied together. Records where `category IS NULL` do not match a category filter.

**Knowledge taxonomy constants:**

```typescript
export const LtmCategory = {
  USER_PREFERENCE: 'user_preference',
  WORLD_FACT: 'world_fact',
  TASK_CONTEXT: 'task_context',
  AGENT_BELIEF: 'agent_belief',
} as const;
```

The type of `category` on `LtmRecord` SHALL remain `string`, not a closed union. Callers MAY supply values outside `LtmCategory` (e.g. `'project_convention'`).

**Consolidation candidates:**

```typescript
interface FindConsolidationOptions {
  similarityThreshold?: number; // default: 0.75
  minAccessCount?: number; // default: 2
  maxCreatedAtSpreadDays?: number; // default: 30 (hippocampus-improvements)
}
```

**Pruning:**

`prune()` hard-deletes records with `retention < minRetention` (default `0.1`). Records that have an incoming `consolidates` edge are tombstoned rather than deleted, preserving the consolidation link.

**Storage adapter:**

`StorageAdapter` is the abstraction over the persistence layer. `SqliteAdapter` is the default implementation. `InMemoryAdapter` is provided for testing. All read and write paths on `StorageAdapter` MUST persist and return `sessionId`, `category`, and `episodeSummary`.

### 5.2 Amygdala (`@memex/amygdala`)

`AmygdalaProcess` is a background process that scores STM entries and gates their promotion to LTM. It runs on a configurable cadence (default 5 minutes) and also triggers when the STM depth reaches `STM_THRESHOLD` (10 entries).

**Configuration:**

```typescript
interface AmygdalaConfig {
  ltm: LtmEngine;
  stm: InsightLog;
  llmAdapter: LLMAdapter;
  sessionId: string; // required; written to every LTM record
  cadenceMs?: number; // default: 300000 (5 min)
  maxBatchSize?: number; // default: 10
  maxLLMCallsPerHour?: number; // default: 200
  lowCostModeThreshold?: number; // default: 150
  singletonPromotionThreshold?: number; // default: 0.7 (amygdala-improvements)
  events?: EventBus;
}
```

`sessionId` is REQUIRED. The amygdala process MUST NOT start without a `sessionId` configured.

**Scoring result:**

The amygdala calls the LLM with a system prompt instructing it to act as an importance-scoring component. The LLM returns a structured result:

```typescript
interface AmygdalaScoringResult {
  action: 'insert' | 'relate' | 'skip';
  targetId?: string;
  edgeType?: 'supersedes' | 'elaborates' | 'contradicts';
  reasoning: string;
  importanceScore: number; // 0.0 to 1.0
}
```

The system prompt instructs: "Be conservative with importance scores. Most observations are 0.1-0.4. Reserve 0.7+ for genuinely significant information."

**Action dispatch:**

On `insert`: the entry is inserted into LTM. The tier is determined by singleton promotion logic (see Section 8.2). The record receives `sessionId` from config, `episodeSummary` from `InsightEntry.text`, and forwarded tags (see Section 8.3).

On `relate`: the entry is inserted into LTM (episodic tier) and an edge is created from the new record to the target. Tag forwarding applies.

On `skip`: the entry is marked processed and discarded. No LTM write occurs.

**Rate limiting:**

The amygdala tracks LLM calls per hour. When `callsThisHour >= maxLLMCallsPerHour`, no further LLM calls are made that hour. When `callsThisHour >= lowCostModeThreshold`, the amygdala enters low-cost mode: context files are not read, and the number of related memories fetched drops from 3 to 1.

**Failure handling:**

Entries that fail scoring are retried with exponential backoff (`500ms`, `2000ms`). After `MAX_CONSECUTIVE_FAILURES` (3) consecutive failures, an entry is tagged `permanently_skipped` and excluded from future batches.

**Locking:**

The amygdala acquires a process lock (`'amygdala'`, TTL = `cadenceMs * 2`) before each cycle. If the lock cannot be acquired, the cycle is deferred.

**Events emitted:**

- `amygdala:cycle:start` — `{ cycleId, pendingCount, startedAt }`
- `amygdala:cycle:end` — `{ cycleId, durationMs, processed, failures, llmCalls, estimatedTokens }`
- `amygdala:entry:scored` — `{ insightId, action, importanceScore, relatedToId, edgeType }`

**Context file lifecycle:**

After a successful LTM insert or relate call, amygdala SHALL immediately set `safeToDelete = true` on the associated context file record. It MUST NOT wait for hippocampus to process the record before marking it safe.

### 5.3 Hippocampus (`@memex/hippocampus`)

`HippocampusProcess` is a scheduled background process that consolidates clusters of related episodic records into semantic records, then prunes decayed records.

**Configuration:**

```typescript
interface HippocampusConfig {
  ltm: LtmEngine;
  llmAdapter: LLMAdapter;
  scheduleMs?: number; // default: 3600000 (1 hour)
  similarityThreshold?: number; // default: 0.85
  minClusterSize?: number; // default: 3
  minAccessCount?: number; // default: 2
  maxLLMCallsPerHour?: number; // default: 200
  maxCreatedAtSpreadDays?: number; // default: 30 (hippocampus-improvements)
  category?: string; // forwarded to consolidated records
  events?: EventBus;
  contextDir?: string;
}
```

**Consolidation cycle:**

1. Acquire process lock (`'hippocampus'`, TTL = `scheduleMs * 2`)
2. Call `ltm.findConsolidationCandidates()` to retrieve similarity-clustered episodic records
3. Apply temporal proximity constraint to each cluster (see Section 7.2)
4. For each cluster that passes the size gate: call LLM to produce a semantic summary
5. Call `ltm.consolidate()` with the summary, deflating source record stability
6. Emit `hippocampus:false-memory-risk` if confidence < 0.5
7. Call `ltm.prune()` (min retention 0.1)
8. Delete all context files with `safeToDelete = true`

**Context file deletion:**

Hippocampus SHALL delete all context files with `safeToDelete === true` after each prune pass without querying LTM for active references. It MUST NOT perform any cross-reference check before deletion.

**Category forwarding:**

When `HippocampusConfig.category` is set, hippocampus SHALL pass it as `category` in the options to every `ltm.consolidate()` call. When not set, no `category` is forwarded.

**Events emitted:**

- `hippocampus:consolidation:start`
- `hippocampus:consolidation:end` — `{ runId, durationMs, clustersConsolidated, recordsPruned, contextFilesDeleted }`
- `hippocampus:false-memory-risk` — `{ recordId, confidence, sourceIds }`

**Locking:**

The hippocampus acquires a process lock before each run. If the lock cannot be acquired, the run is skipped silently.

### 5.4 Memory Orchestrator (`@memex/memory`)

`Memory` is the sole public interface for agent code. Agent code MUST NOT interact with `LtmEngine`, `AmygdalaProcess`, or `HippocampusProcess` directly.

**Interface:**

```typescript
interface Memory {
  readonly sessionId: string;
  readonly events: MemoryEventEmitter;

  logInsight(options: LogInsightOptions): void;
  recall(nlQuery: string, options?: LtmQueryOptions): ResultAsync<LtmQueryResult[], LtmQueryError>;
  recallSession(
    query: string,
    options: { sessionId: string } & Omit<LtmQueryOptions, 'sessionId'>,
  ): Promise<LtmQueryResult[]>;
  recallFull(
    id: number,
  ): ResultAsync<{ record: LtmRecord; episodeSummary: string | undefined }, RecordNotFoundError>;
  getStats(): Promise<MemoryStats>;
  pruneContextFiles(options: { olderThanDays: number }): Promise<PruneContextFilesReport>;
  shutdown(): Promise<ShutdownReport>;
}
```

**Factory:**

```typescript
interface MemoryConfig {
  storagePath: string;
  sessionId: string; // required; forwarded to AmygdalaConfig
  contextDirectory?: string;
  llmAdapter: LLMAdapter;
  embeddingAdapter?: EmbeddingAdapter;
  compressionThreshold?: number;
  amygdalaCadenceMs?: number;
  hippocampusScheduleMs?: number;
  maxTokens?: number;
  maxLLMCallsPerHour?: number;
  lowCostModeThreshold?: number;
}

function createMemory(config: MemoryConfig): Promise<CreateMemoryResult>;
```

`sessionId` is REQUIRED on `MemoryConfig`. Omitting it is a compile-time type error. `createMemory()` SHALL forward `sessionId` to `AmygdalaConfig.sessionId`.

**`recallSession`:**

`recallSession(query, { sessionId, ...options })` delegates to `ltm.query()` with `sessionId` fixed to the supplied value. `sessionId` is required in the options object (not a separate parameter). Additional `LtmQueryOptions` MAY be supplied to further filter by tier, category, or date range. When no records match, an empty array SHALL be returned without error.

**`recallFull`:**

`recallFull(id)` fetches a record by numeric ID and returns a `ResultAsync` resolving to the record plus `episodeSummary`. `episodeSummary` is `undefined` when the record has no summary (semantic records, or pre-migration episodics). When the ID does not exist, the `ResultAsync` resolves to a `RecordNotFoundError`.

**`recall` default behavior:**

`recall()` delegates to `ltm.query()` with `strengthen: false` as the default. Callers MAY override via `options`.

**Shutdown:**

`shutdown()` sets `isShuttingDown = true`, runs one final amygdala cycle to drain pending STM entries, stops both background processes, and returns a `ShutdownReport`.

---

## 6. Retrieval

### 6.1 Semantic Search

Retrieval begins by embedding the natural language query using the configured `EmbeddingAdapter`. The query embedding is compared against all candidate records using cosine similarity.

```
cosine_similarity(a, b) = dot(a, b) / (|a| * |b|)
```

All stored records MUST share the same embedding model. If the model ID of stored records does not match the query model ID, an `EMBEDDING_MODEL_MISMATCH` error SHALL be returned.

Candidates are pre-filtered by `tier`, `minImportance`, `after`, `before`, `minStability`, `minAccessCount`, `sessionId`, and `category` before similarity is computed. Pre-filters are applied as SQL WHERE clauses. Only matching rows are loaded into memory for scoring.

### 6.2 Temporal Weighting

The temporal ranked list scores each candidate as:

```
temporal_score = cosine_similarity * retention(record)
```

where:

```
retention(record) = exp(-ageDays / stability)
ageDays = (now - lastAccessedAt) / ms_per_day
```

This causes recently-accessed and high-stability records to rank higher than older, less stable ones. Retention is re-computed at query time; it is not stored.

Records with `retention < DECAY_THRESHOLD` (0.2) emit a `ltm:record:decayed-below-threshold` event. Records with effective score below the query threshold (default `0.5`) are excluded from results.

### 6.3 Graph Traversal

Associative retrieval traverses outgoing edges from the top `TOP_SEMANTIC_CANDIDATES` (10) semantically-ranked candidates. Edges of type `elaborates`, `supersedes`, and `consolidates` pull their target records into the associative ranked list with a damped score:

```
associative_score = source_cosine * retention(edge) * ASSOCIATIVE_SCORE_FACTOR (0.7)
```

Edges of type `contradicts` pull the target into the associative list without score amplification, ensuring contradicting memories surface alongside the primary result.

Graph traversal adds discovered record IDs to `graphTraversalIds`. On strengthening, graph-traversal records receive a reduced RRF normalization factor (`ASSOCIATIVE_RRF_FACTOR = 0.5`).

### 6.4 RRF Merge

Results from semantic, temporal, and associative ranked lists are merged using Reciprocal Rank Fusion:

```
rrf_score(d) = sum over lists L: 1 / (k + rank_L(d))
k = 60
```

Records not appearing in a list are not penalized; they simply receive no contribution from that list. The merged RRF map determines the order of candidates entering the final filter step.

### 6.5 Session-Scoped Recall

When `sessionId` is provided in `LtmQueryOptions`, only records with a matching `session_id` column value are eligible candidates. The filter is applied as a SQL WHERE clause before embedding scoring, enabling O(log n) session-scoped retrieval via the composite index `(session_id, tier, created_at)`.

`recallSession(query, { sessionId, ...options })` on the `Memory` interface is the ergonomic surface for this capability. It locks `sessionId` to the supplied value and delegates to `ltm.query()`.

---

## 7. Consolidation

### 7.1 Clustering Algorithm

Episodic records eligible for consolidation must satisfy:

- `tier === 'episodic'`
- `accessCount >= minAccessCount` (default: 2)
- `tombstoned === false`

Eligible records are clustered by cosine similarity using a greedy algorithm. Two records belong to the same cluster if their embedding cosine similarity meets or exceeds `similarityThreshold` (default: 0.85). Each cluster is evaluated against `minClusterSize` (default: 3) before proceeding to consolidation.

### 7.2 Temporal Proximity Constraint

After similarity-based clustering, each cluster is evaluated for temporal coherence. This prevents episodic records from semantically distinct time periods from being merged into a single generalization.

**Algorithm (applied per cluster before any LLM call):**

1. Sort records in the cluster by `createdAt` ascending.
2. Compute spread: `max(createdAt) - min(createdAt)` in days.
3. If spread exceeds `maxCreatedAtSpreadDays` (default: 30):
   a. Scan consecutive record pairs to find the largest time gap.
   b. Split the cluster into two sub-clusters at that gap index.
   c. Evaluate each sub-cluster independently against `minClusterSize`.
   d. Discard sub-clusters with fewer than `minClusterSize` records.
4. Only sub-clusters that pass the size gate proceed to the LLM call.

When `maxCreatedAtSpreadDays` is `undefined`, the temporal constraint MUST NOT be applied. All clusters pass through as-is.

Only one split is performed per run at the single largest gap. Further temporal fragmentation within a sub-cluster is deferred to subsequent consolidation runs as records accumulate. Discarded sub-clusters remain as episodic records unchanged.

### 7.3 Pruning Policy

`prune()` is called after each consolidation pass. It targets records where `retention(record) < minRetention` (default: 0.1).

- Records with an incoming `consolidates` edge are **tombstoned** (marked deleted but retained as historical references).
- Records without a `consolidates` edge are **hard-deleted**.

Tombstoned records do not appear in query results. They do appear in `stats()` counts.

---

## 8. Importance Scoring

### 8.1 Scoring Model

The amygdala uses a structured LLM call with the following system prompt (abridged):

> You are the amygdala of a cognitive memory system. For each observation, assess its importance (0.0 = trivial, 1.0 = critical) and determine the appropriate action: insert, relate, or skip. Be conservative with importance scores. Most observations are 0.1-0.4. Reserve 0.7+ for genuinely significant information.

Initial stability is derived from importance at insert time:

```
stability_initial = 1 + importance * 9
```

This yields a range of 1 day (importance = 0) to 10 days (importance = 1) at insertion. Stability grows on retrieval access via the strengthening function.

**Strengthening:**

When `strengthen: true` on a query, each retrieved record's stability is updated:

```
growth_factor = 1 + 2 * (1 - retention_at_retrieval)
new_stability = min(365, max(0.5, stability * growth_factor * normalized_rrf_score))
```

Records retrieved via graph traversal receive `normalized_rrf_score * 0.5` to dampen associative strengthening.

### 8.2 Singleton Promotion

The `minClusterSize = 3` gate in hippocampus consolidation means any episodic without at least 2 near-neighbors can never be consolidated and will eventually be pruned, even if its importance score is high. Singleton promotion addresses this data loss.

**Promotion condition (evaluated in `applyAction`):**

- `action === 'insert'`
- `importanceScore >= singletonPromotionThreshold` (default: 0.7)
- The related memories list passed from `processEntry` is empty (no LTM candidates existed for the LLM to evaluate)

When all three conditions are met, the LTM insert uses `tier: 'semantic'` rather than `'episodic'`. The promoted record bypasses the hippocampus pipeline entirely — it is already a semantic fact.

When the related memories list is non-empty (even if `action === 'insert'`), the record is stored as episodic. The presence of related memories is the signal that a semantic neighborhood exists for eventual consolidation.

Promotion MUST NOT fire on `relate` actions. Singleton promotion MUST NOT issue an additional `ltm.query()` call; it uses the relatedness list already computed before the LLM scoring call.

**`singletonPromotionThreshold` default alignment:**

The default of `0.7` matches the LLM system prompt's semantic boundary for "genuinely significant information", ensuring consistency between the LLM's scoring rubric and the promotion gate.

### 8.3 Tag Forwarding

`InsightEntry.tags` are agent-supplied labels applied to observations before ingestion. These tags are consumed by the amygdala for internal filtering but were previously never written to LTM, causing silent data loss.

When amygdala inserts a record into LTM (action `insert` or `relate`), the `InsightEntry.tags` minus internal amygdala tags SHALL be written to `metadata.tags` on the inserted record.

Internal tags that MUST NOT be forwarded:

- `permanently_skipped`
- `llm_rate_limited`

These tags are defined in a module-level constant `INTERNAL_TAGS` in `amygdala-schema.ts`. Tag filtering logic SHALL reference this constant, not inline string literals.

When `InsightEntry.tags` is empty, or contains only internal tags, `metadata.tags` SHALL be an empty array.

---

## 9. Schema Extensions

The `ltm-schema-extensions` change introduces three new columns to `LtmRecord` and one insert-time tier override. All four are coordinated in a single SQLite migration.

### 9.1 `sessionId`

`sessionId: string` is a REQUIRED field on every `LtmRecord`. It is populated at insert time by the amygdala from `AmygdalaConfig.sessionId`, which is sourced from `MemoryConfig.sessionId` via the factory.

- The `session_id` column is `NOT NULL`. Pre-migration records receive `'legacy'` as a sentinel.
- Callers querying with `sessionId: 'legacy'` retrieve all pre-migration records as a cohort.
- The composite index `(session_id, tier, created_at)` enables O(log n) session-scoped retrieval.
- `InsightEntry` does not carry a `sessionId`; the amygdala is per-session by design.

### 9.2 `category`

`category?: string` is an OPTIONAL field on `LtmRecord`. It represents a knowledge domain or taxonomy classification.

- The `category` column is nullable with no default. Absence means uncategorized.
- The library MUST NOT default, infer, or validate `category` — it is always caller-supplied.
- Amygdala does NOT set `category`; that is caller responsibility (via tags, metadata, or direct insert).
- Hippocampus MAY forward a configured `category` to consolidated semantic records.
- A single-column index on `category` enables efficient category-scoped queries.
- `LtmCategory` exports well-known constants; callers MAY extend with domain-specific strings.

### 9.3 `episodeSummary`

`episodeSummary?: string` is an OPTIONAL field on `LtmRecord`. It stores the STM-compressed text from `InsightEntry.text` inline on the record, eliminating the external context file dependency.

- Populated only for episodic records produced by the amygdala. Semantic records SHALL have `episodeSummary === undefined`.
- The library MUST NOT compute or derive this value. It is always caller-supplied at insert time.
- Storage cost is bounded: STM-compressed text is typically 200-800 characters. At 10,000 records, worst-case inline storage is approximately 8 MB.
- `recallFull(id)` on the `Memory` interface returns `episodeSummary: string | undefined`. `undefined` is the signal that the record exists but has no episode summary.
- Context files are marked `safeToDelete = true` immediately after `episodeSummary` is written to LTM. They MUST NOT be marked safe before the LTM write succeeds.

---

## 10. Conformance Requirements

A conforming implementation of Memex MUST satisfy all normative requirements (MUST / MUST NOT / SHALL / SHALL NOT) stated in this document. The following is a summary of the most critical behavioral invariants:

**LTM Store:**

- MUST apply `sessionId` and `category` filters as SQL WHERE clauses before embedding scoring.
- MUST default `metadata.confidence` to `1.0` when `tier: 'semantic'` is inserted without a confidence value.
- MUST NOT compute or infer `episodeSummary`. It is always caller-supplied.
- MUST persist `sessionId`, `category`, and `episodeSummary` on all read and write paths.
- MUST return `EMBEDDING_MODEL_MISMATCH` when query model ID differs from stored model ID.

**Amygdala:**

- MUST NOT start without `sessionId` in `AmygdalaConfig`.
- MUST write `sessionId` from config to every LTM record it inserts.
- MUST write `InsightEntry.text` as `episodeSummary` on every LTM insert.
- MUST mark context file `safeToDelete = true` immediately after a successful LTM write.
- MUST NOT mark context file `safeToDelete` if the LTM write fails.
- MUST forward agent-supplied tags (minus `INTERNAL_TAGS`) to `metadata.tags`.
- MUST use `tier: 'semantic'` when singleton promotion conditions are met.
- MUST NOT issue an extra `ltm.query()` call to determine singleton status.

**Hippocampus:**

- MUST apply the temporal proximity constraint before any LLM call.
- MUST split a cluster at its single largest consecutive time gap when spread exceeds threshold.
- MUST evaluate each sub-cluster independently against `minClusterSize` after splitting.
- MUST NOT further split sub-clusters within the same run.
- MUST delete all `safeToDelete = true` context files unconditionally.
- MUST NOT cross-reference LTM records before deleting context files.

**Memory:**

- MUST require `sessionId` on `MemoryConfig` (compile-time enforcement via TypeScript).
- MUST forward `sessionId` from `MemoryConfig` to `AmygdalaConfig`.
- `recallFull` MUST return `episodeSummary: undefined` (not `null`) when the record has no summary.
- `recallFull` MUST resolve to `RecordNotFoundError` (via `ResultAsync`) for unknown IDs.
- `recallSession` MUST return an empty array (not throw) when no records match the session.

**Schema migration:**

- The v2 migration MUST use `DEFAULT 'legacy'` for `session_id NOT NULL` to avoid row-level backfill.
- Rollback of the v2 migration requires a pre-migration database backup. SQLite versions before 3.35.0 do not support `DROP COLUMN`.

---

## 11. References

- Vannevar Bush, "As We May Think," _The Atlantic_, July 1945.
- RFC 2119, "Key words for use in RFCs to Indicate Requirement Levels," S. Bradner, 1997.
- SQLite FTS5 documentation: https://www.sqlite.org/fts5.html
- Reciprocal Rank Fusion: Cormack, Clarke, Buettcher, "Reciprocal Rank Fusion Outperforms Condorcet and Individual Rank Learning Methods," SIGIR 2009.
- Ebbinghaus forgetting curve (retention model basis): H. Ebbinghaus, _Über das Gedächtnis_, 1885.
- `neverthrow` library for typed Result/ResultAsync: https://github.com/supermacro/neverthrow
