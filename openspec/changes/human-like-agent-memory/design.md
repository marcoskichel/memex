## Context

The current `packages/engram` package is a flat in-memory associative store: all records are equal, nothing decays, retrieval has no side effects, and there is no persistence. It cannot serve as genuine long-term memory for AI agents — it is a session-scoped similarity index at best.

This design introduces a five-package memory system modeled on human long-term memory. The core insight is that context compression (shrinking the agent's context window) and memory formation (writing to the insight log) are the same operation — unifying what would otherwise be two separate concerns.

## Goals / Non-Goals

**Goals:**

- Memory records decay exponentially over time; unused memories fade and are eventually pruned
- Retrieval strengthens stability using the spacing effect (bigger gain when retrieved just before forgetting)
- Records are immutable once created; "updates" produce a new record linked to the old via a typed relationship edge
- Relationship edges decay independently; when a supersedes link fades, both records surface equally (human-like confusion state)
- Context compression produces STM insight log entries simultaneously — one LLM call, two effects
- An async amygdala process gates importance scoring so agents never block on memory writes
- A periodic hippocampus process consolidates episodic clusters into semantic memories and prunes decayed records
- Storage is pluggable: `InMemoryAdapter` for tests, `SqliteAdapter` (better-sqlite3) for production
- Agent code touches only `@neurokit/memory`; all other packages are internal

**Non-Goals:**

- Real-time (inline) amygdala scoring — importance assignment is always async
- Vector database with ANN indexing — brute-force cosine over 128-dim embeddings is sufficient at agent scale (hundreds to low-thousands of records)
- Multi-agent shared memory — each agent instance has its own memory; cross-agent memory is out of scope
- Procedural or sensory memory — only declarative (episodic + semantic) memory is modeled
- Emotion simulation beyond the importance scalar

## Decisions

### 1. Append-only records with relationship graph

**Decision:** Records are immutable after creation. Data changes go through `insert() + relate('supersedes')`. `update()` patches metadata only.

**Why:** Human memory does not overwrite — it adds a new competing trace and links it to the old. When the link decays, both memories surface without hierarchy. Modeling this accurately requires immutability. It also makes the store auditable and append-only, which simplifies the SQLite adapter (no UPDATE on the data column).

**Alternatives considered:** Mutable records with a version history field — rejected because it conflates the record (the memory) with its history (the relationship graph), and loses the ability for the link itself to decay.

---

### 2. Edges have independent stability and decay

**Decision:** `RecordRelationship` has its own `stability`, `lastAccessedAt`, and `accessCount`. Edge initial stability is seeded from the importance of the `fromId` record.

**Why:** When a supersedes link fades, the correction signal disappears — exactly like human spontaneous recovery of old beliefs. If edges were permanent, the system would always know which record is current, which is not how human memory works. When a supersedes link has retention ≤ 0.3, neither record is tagged — the agent experiences genuine uncertainty.

**Alternatives considered:** Permanent edges with a weight field — rejected because it cannot model the "link lost" confusion state.

---

### 3. Spacing effect for stability growth

**Decision:** `growthFactor = 1 + 2.0 × (1 - retention_at_retrieval)`. Stability doubles approximately when retrieved at 50% retention; small gain when retrieved fresh.

**Why:** Matches the well-studied spacing effect in human memory. A flat multiplier (e.g. always ×2) ignores when the retrieval happens, which misses the most important variable. This formula rewards retrieving things just before they're forgotten, not immediately after storing them.

**Alternatives considered:** Flat ×2 multiplier — rejected because it gives equal benefit regardless of timing.

---

### 4. Graduated strengthening proportional to confidence

**Decision:** Each returned record's stability grows by `fullGrowth × (record.effectiveScore / topResult.effectiveScore)`. Top result gets full growth; lower results get proportionally less.

**Why:** Retrieving 20 records and strengthening all equally would over-stabilise peripheral results the agent barely noticed. Graduated strengthening mirrors how human attention focuses rehearsal benefit on the most salient material.

---

### 5. No explicit conflict flag when link decays

**Decision:** When a supersedes edge has retention > 0.3, the `toId` record is tagged `superseded: true`. When retention ≤ 0.3, both records surface without any tag.

**Why:** Human memory does not raise a conflict flag when the correction link fades — the agent genuinely does not know which is current. Surfacing a `conflictState: 'lost'` flag would be dishonest about the epistemic state. The absence of a tag IS the signal.

---

### 6. Storage adapter pattern with better-sqlite3 for production

**Decision:** The engine depends on a `StorageAdapter` interface. Ships with `InMemoryAdapter` (default) and `SqliteAdapter` (better-sqlite3). Embeddings stored as BLOB (raw Float32Array buffer). Cosine similarity computed in JS after SQL pre-filtering.

**Why better-sqlite3 over alternatives:**

- LanceDB: no native graph/relational model, no Alpine support, ~100MB Rust binary — too heavy for a library package
- sqlite-vec extension: at agent scale (hundreds to thousands of records), JS brute-force cosine over 128-dim vectors is sub-millisecond; adding a second native binary buys nothing
- node:sqlite (Node built-in): still experimental in Node 22/24; not safe as a hard library dependency yet
- Kuzu (graph + vector): abandoned by maintainers October 2025

**Migration path:** When `node:sqlite` stabilizes, swap `SqliteAdapter` internals with zero API impact.

**Known risk:** better-sqlite3 native binaries conflict with Node.js 24 (V8 API deprecation). Node.js 22 LTS is the safe target. Document this constraint explicitly.

---

### 7. Context compression = STM entry creation (same operation)

**Decision:** The `stm-compression` module produces two outputs from one LLM call: a compressed string (replaces raw phase in context window) and an `InsightEntry` (appended to the STM log). The full raw phase is saved to a context file before compression.

**Why:** These are not separate concerns. Compressing a chunk of context IS forming a memory. Treating them as two separate LLM calls doubles cost with no benefit. The unified operation also ensures the insight log always reflects what the context window has released — there is no divergence between what the agent forgot and what was logged.

---

### 8. Amygdala as async background process with retrieval-encoding overlap

**Decision:** The amygdala runs on a cadence (default every 5 minutes or when log exceeds 10 entries). For each insight, it queries LTM for related memories before scoring importance — if related memories exist, the action may be `relate` rather than `insert`.

**Why:** Agents MUST NOT block on importance scoring. An inline amygdala would add LLM latency to every memory write. The retrieval-encoding overlap (checking existing LTM before inserting) mirrors how human memory encodes new experiences in relation to existing ones, reducing redundant episodic records and strengthening existing ones instead.

---

### 9. Package boundary: agents only import @neurokit/memory

**Decision:** `@neurokit/memory` is the sole public interface for agent code. All other packages are internal dependencies.

**Why:** Agents should not need to understand the amygdala/hippocampus lifecycle, adapter configuration, or STM queue semantics. Hiding these behind a single `createMemory()` + `logInsight()` + `recall()` surface reduces integration complexity and allows internal restructuring without breaking agent code.

## Risks / Trade-offs

- **better-sqlite3 Node 24 incompatibility** → Document Node 22 LTS as required; track better-sqlite3 v12+ for resolution
- **Amygdala lag** → Insights are processed with up to 5-minute delay; agents may repeat observations the amygdala hasn't processed yet → Acceptable; mirrors how human memory consolidation is not instantaneous
- **False memories via consolidation** → LLM summarization during hippocampus pass may produce synthetic content not present in any source episode → Mitigated by `sourceIds` on semantic records (traceable while episodics survive); fully human-like behavior once episodics are pruned
- **Brute-force cosine at scale** → If agent record count exceeds ~50k, query latency will grow → Out of scope for v1; adapter interface allows future swap to ANN-indexed backend without API change
- **Context file disk usage** → Each compressed phase writes a context file; long sessions produce many files → Hippocampus or a separate maintenance pass should clean up context files for processed+old STM entries

## Migration Plan

1. Rename `packages/engram` → `packages/ltm`; update `package.json` name to `@neurokit/ltm`
2. Update `openspec/workspace.yaml`: scope `engram` → `ltm`, path `packages/engram` → `packages/ltm`
3. Update `pnpm-workspace.yaml` if explicit package paths are listed
4. Rebuild `@neurokit/ltm` from scratch per the new architecture (the existing `EngramEngine` class is replaced entirely)
5. Create `packages/stm`, `packages/amygdala`, `packages/hippocampus`, `packages/memory` as new pnpm packages
6. Wire all packages into `turbo.json` build pipeline

No external consumers exist yet; no backwards-compatibility shims needed.

## Open Questions

- Amygdala LLM client: which model/SDK should the amygdala and hippocampus use? Should they accept any OpenAI-compatible client, or couple to a specific SDK?
- Context file storage location: should context files be co-located with the SQLite database file, or configurable independently?
- Hippocampus scheduling: cron-style schedule string, or interval-in-milliseconds API?
- STM persistence: should the STM insight log optionally persist across restarts (e.g. if the process crashes mid-session), or is in-memory-only always correct?
