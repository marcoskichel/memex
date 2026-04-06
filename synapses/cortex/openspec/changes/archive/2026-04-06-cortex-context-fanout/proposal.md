## Why

`getContext` queries LTM with `JSON.stringify(toolInput)` — a file path or shell command. Insights like "User is building a memory SDK" have near-zero cosine similarity to `{"file_path":"/tmp/cortex.log"}` and are never returned, so agents receive no identity or project context from memory even when it was previously recorded.

## What Changes

- `getContext` MUST issue at least two additional parallel recall queries alongside the primary tool-input query: one targeting agent identity/goals and one targeting project/task context.
- Results from all queries MUST be merged by record ID (deduped), sorted by `effectiveScore` descending, and capped at `RECALL_LIMIT_FOR_CONTEXT`.
- Failure of any secondary query MUST NOT fail the overall `getContext` call — partial results are returned gracefully.
- No LLM calls on the read path. Secondary queries are static natural-language strings.

## Capabilities

### New Capabilities

- `context-retrieval`: `getContext` fans out across multiple semantic angles (tool input, agent identity, project context) and returns a merged, deduped, scored result set.

### Modified Capabilities

(none — cortex has no existing specs)

## Impact

- `packages/cortex/src/ipc/handlers.ts` — `getContext` function rewritten to use `Promise.all` fan-out
- No schema changes — `LtmQueryOptions` already supports all needed options
- No changes to `@memex/ltm`, `@memex/memory`, or any other package
- Latency: ~+200ms (3 parallel embedding calls vs 1); future optimization via batch embedding API is possible but not in scope
