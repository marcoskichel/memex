## Context

The amygdala extracts named entities from observations via LLM structured output and stores them in `metadata.entities` on each LTM record. Currently, entity names are stored exactly as the LLM produces them — "Alice", "alice", and "Alice Smith" become three distinct entity entries. The query-side filter already does `toLowerCase()` + `includes()` (partial match), so case is handled at read time, but divergent aliases still fragment the index.

## Goals / Non-Goals

**Goals:**

- Entity names are always stored lowercase (eliminates case fragmentation)
- LLM is guided to use the most complete known form of a name (reduces alias fragmentation)
- No breaking change to `EntityMention` interface or existing query callers

**Non-Goals:**

- Alias resolution across observations (resolving "the CEO" → "Alice Smith" based on prior context) — this requires a stateful entity registry and is out of scope
- Backfilling existing LTM records — query-side `toLowerCase()` already handles reads on old records

## Decisions

### A: Normalize in `parseEntities`, not in `insert`

Entity names are lowercased inside `parseEntities` (amygdala-schema.ts) immediately after LLM output is parsed. This keeps normalization co-located with extraction and means LTM never sees unnormalized entity data regardless of call site.

Alternative: normalize inside `LtmEngine.insert`. Rejected — LTM shouldn't know about amygdala-specific conventions; normalization is a property of the extraction step.

### B: Prompt engineering for canonical names

The amygdala system prompt is extended to instruct: prefer the most complete known proper name; fall back to role/alias only when no proper name is available.

Alternative: post-hoc alias resolution via a second LLM call. Rejected — adds latency and cost for marginal gain; the root cause is at extraction time.

## Risks / Trade-offs

- [Mixed-case records in existing DB] → Query-side already applies `toLowerCase()` so old records remain queryable; no migration needed
- [LLM may still produce inconsistent canonical forms] → Prompt guidance reduces this but cannot eliminate it entirely; full alias resolution is a future concern
