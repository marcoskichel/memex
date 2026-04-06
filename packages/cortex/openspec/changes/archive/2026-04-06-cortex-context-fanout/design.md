## Context

`getContext` in `packages/cortex/src/ipc/handlers.ts` is called on every pre-tool-use hook invocation to inject relevant memories into the agent's context window. It currently issues a single LTM query using `JSON.stringify(toolInput)` as the query text. Tool inputs are file paths, shell commands, or structured JSON objects — none of which are semantically close to stored insights about agent identity or project context.

The fix requires no schema changes. `LtmQueryOptions` already supports all needed options. The change is purely in the query strategy inside `getContext`.

## Goals / Non-Goals

**Goals:**

- Insights about agent identity and project context are returned by `getContext` even when the tool input is semantically unrelated
- All secondary queries run in parallel with the primary query (no serial latency stacking)
- A failure in any secondary query does not fail the overall `getContext` call
- Result count stays bounded at `RECALL_LIMIT_FOR_CONTEXT`

**Non-Goals:**

- LLM-assisted query enrichment (no LLM calls on the read path)
- Per-tool-type query customization (secondary queries are static)
- Changing `LtmQueryOptions`, `LtmEngine`, or any package outside `cortex`
- Batch embedding optimization (deferred until latency is measured as a real problem)

## Decisions

### Decision: Two static secondary queries

The secondary queries are fixed strings:

1. `"current user identity, agent goals, session context"`
2. `"project being built, architectural decisions, codebase overview"`

**Rationale:** These cover the two most common miss-cases: identity queries ("who am I") and task queries ("what am I building"). Static strings are zero-cost, require no LLM call, and are easy to tune. If future sessions show different miss patterns, the strings can be updated.

**Alternatives considered:**

- Dynamic query generation via LLM: rejected — adds ~300-500ms latency on the hot pre-tool-use path
- Per-tool-type secondary queries: rejected — adds complexity with marginal benefit; tool type doesn't reliably predict what context is needed

### Decision: Merge by record ID, sort by effectiveScore

After collecting results from all three queries, dedup by `record.id` (keep first occurrence, which will be the highest-scoring one since each query result is already sorted), then sort the merged set by `effectiveScore` descending, and slice to `RECALL_LIMIT_FOR_CONTEXT`.

**Rationale:** Simple, deterministic, no additional LTM calls. The same record can appear in multiple query results; keeping the first avoids re-scoring.

### Decision: Secondary query limit set independently from primary

Primary query: `limit: RECALL_LIMIT_FOR_CONTEXT` (5). Each secondary query: `limit: 2`. Total candidates before dedup: up to 9.

**Rationale:** Secondary queries are intentionally narrower — we want a few high-relevance identity/context memories, not to flood the context window with them. The merged result is still capped at 5.

## Risks / Trade-offs

[Latency increase] → Three parallel embedding calls instead of one. Expected ~+100-200ms depending on OpenAI API latency. Mitigation: run with `Promise.all` (already parallelized). Batch embedding optimization available if needed.

[Secondary query strings become stale] → If stored insights use different vocabulary, static strings may miss. Mitigation: secondary queries are short natural-language phrases that embed broadly; they're designed to be fuzzy.

[Threshold filtering still applies] → Records below `DEFAULT_QUERY_THRESHOLD = 0.5` are excluded even from secondary queries. Very old or low-importance identity memories may still be missed. Mitigation: this is correct behavior — low-retention memories should not pollute context.
