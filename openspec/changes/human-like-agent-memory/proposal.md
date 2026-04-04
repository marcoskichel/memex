## Why

AI agents currently lack a memory system that mirrors how human long-term memory works: existing solutions treat memory as a static archive where all records are equal, nothing is forgotten, and retrieval has no side effects. This produces agents that accumulate noise indefinitely, surface stale or superseded beliefs with equal confidence as current ones, and never build durable semantic knowledge from repeated experience. The neurokit memory system replaces this with a biologically-inspired architecture where memories decay, strengthen through use, and consolidate from episodic events into semantic knowledge — giving agents memory that behaves like a human brain, not a database.

## What Changes

- **BREAKING** Rename `packages/engram` → `packages/ltm`; package name `@neurokit/engram` → `@neurokit/ltm`
- Introduce decay and stability: every memory record has a `stability` value (days) and decays exponentially over time; retrieval strengthens stability using the spacing effect
- Introduce the relationship graph: records are immutable once created; "updates" produce a new record linked to the old via a typed edge (`supersedes`, `contradicts`, `elaborates`, `consolidates`); edges decay independently
- Replace in-memory-only storage with a pluggable adapter pattern (`InMemoryAdapter` for tests, `SqliteAdapter` for production)
- Add `@neurokit/stm` — session-scoped insight log and context compression; the bridge between an agent's running context and long-term memory
- Add `@neurokit/amygdala` — async background process that reads the STM insight log, scores importance via LLM, and writes to LTM
- Add `@neurokit/hippocampus` — async background process that clusters episodic LTM memories, consolidates them into semantic records via LLM, and prunes decayed records
- Add `@neurokit/memory` — top-level orchestrator that wires all subsystems together and provides the agent integration pattern

## Capabilities

### New Capabilities

- `ltm-storage`: Append-only node store with typed relationship graph, pluggable persistence adapters, and full CRUD surface
- `ltm-decay`: Exponential retention decay and rehearsal-based stability growth per record and per edge
- `ltm-query`: Semantic similarity search with effective score (similarity × retention), relationship-aware result ranking, and graduated strengthening on retrieval
- `ltm-consolidation`: API surface for grouping episodic candidates and merging them into semantic records with inherited stability
- `stm-insight-log`: Append-only session insight queue with context file pointers; consumed by the amygdala process
- `stm-compression`: Context compression strategy that collapses tool calls, results, and agent thoughts into compact insights at configurable thresholds; simultaneously shrinks context and populates the insight log
- `amygdala-scoring`: Background LLM process that reads the STM log, scores importance (0–1), and calls LTM insert or relate accordingly; includes retrieval-encoding overlap check
- `hippocampus-consolidation`: Background LLM process that clusters episodic LTM records, summarizes clusters, calls LTM consolidate, and runs prune on a configurable schedule
- `memory-orchestration`: Top-level package wiring all subsystems; exposes `logInsight()` as the agent's sole memory interface

### Modified Capabilities

- `associative-memory`: Existing in-memory associative store is superseded by `ltm-storage` + `ltm-decay` + `ltm-query`; the current `EngramEngine` class is replaced entirely

## Impact

- `packages/engram` renamed to `packages/ltm`; consumers must update their import paths
- `packages/stm`, `packages/amygdala`, `packages/hippocampus`, `packages/memory` are net-new directories in the pnpm workspace
- `pnpm-workspace.yaml` and `turbo.json` updated to include new packages
- `openspec/workspace.yaml` scope `engram` renamed to `ltm` with updated path
- No external ML or vector database dependencies; `better-sqlite3` added to `@neurokit/ltm` for the SQLite adapter; LLM client dependency in `@neurokit/amygdala` and `@neurokit/hippocampus`
