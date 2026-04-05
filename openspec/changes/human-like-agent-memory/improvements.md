# Pending Work: Human-Like Agent Memory

All items from the original design phase and the three follow-on changes (`ltm-schema-extensions`, `amygdala-improvements`, `hippocampus-improvements`) are implemented. This document tracks what remains.

---

## Planned Specs

### A. Persistent Daemon

**Decision:** The amygdala and hippocampus processes MUST run as a single long-lived daemon, not be re-instantiated per hook invocation.

**Rationale:**

- TransformersJS embedding model cold-start is expensive; re-loading per hook call makes it unusable in practice.
- Amygdala cadence (default: every 5 min) requires continuity across tool calls; a fresh process has no timer state.
- Hook processes are too short-lived for background daemons to do any meaningful work.

**Scope:**

- A daemon process hosts `AmygdalaProcess`, `HippocampusProcess`, and the `LtmEngine` SQLite connection.
- Hook scripts communicate with the daemon over IPC or a local socket (mechanism TBD during design).
- `Memory.shutdown()` drains in-flight work and closes the daemon cleanly.
- Placement in the workspace is TBD (may be co-located with the hooks adapter — see Item B).

**Status:** Design decision made. Implementation not started. Placement TBD pending hooks adapter naming.

---

### B. Claude Code Hooks Adapter

**Decision:** A runnable integration — not a reusable library package — that bridges Claude Code's hook event system to the neurokit memory API.

**Rationale:**

- Claude Code fires lifecycle hooks (`PreToolUse`, `PostToolUse`, `PostSessionEnd`, etc.) as short-lived processes with JSON payloads on stdin. The SDK needs a concrete adapter that speaks this protocol.
- Packaging it as a library would create a false abstraction; no other runtime is being targeted. It should be a first-class executable workspace member.

**Scope:**

- Parse hook payloads from stdin (Claude Code hook JSON format).
- On `PostToolUse`: call `memory.logInsight()` with the tool result context.
- On hook events that inject context (e.g. before tool calls): call `memory.recall()` and write retrieved memories to a context file or stdout for the agent to consume.
- On `PostSessionEnd`: call `memory.shutdown()` to drain and close the daemon.
- Communicates with the persistent daemon (Item A) rather than instantiating its own memory stack.
- Lives in a new top-level workspace directory — name TBD (naming exercise underway separately).

**Status:** Design decision made. Implementation not started. Directory name TBD.

---

## Deferred

### Low Priority

**Semantic re-consolidation cycle** — A second hippocampus pass targeting semantic records with `elaborates`/`contradicts` incoming edges from newer episodics, producing a superseding semantic record. Defer until the base consolidation cycle is stable; risk of infinite loop without a visited-set guard.

**`expiresAt` on `ConsolidateOptions`** — Explicit wall-clock expiry for time-bounded semantic facts. Hippocampus tombstones the record at `expiresAt` regardless of stability.

**Document procedural memory exclusion** — JSDoc on `Memory.recall()` and `createMemory()` noting that behavioral rules must be managed by the consumer and injected into the system prompt externally.

### V2 (Intentionally Out of Scope for V1)

| Capability                   | Notes                                                                             |
| ---------------------------- | --------------------------------------------------------------------------------- |
| BM25/FTS5 retrieval strategy | FTS5 table already created (no-op); wire into retrieval pipeline in v2            |
| Cross-encoder reranking      | Re-rank RRF results with a cross-encoder for higher precision                     |
| sqlite-vec ANN indexing      | Relevant only above ~20k records; brute-force cosine is sufficient at agent scale |

---

## Blocked

**`recall()` default `strengthen: true`** — Agreed but blocked on [marcoskichel/memex#1](https://github.com/marcoskichel/memex/issues/1). Do not change the `memory-impl.ts` default until that issue is resolved.
