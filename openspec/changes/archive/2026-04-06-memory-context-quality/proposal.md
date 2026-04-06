# memory-context-quality

## What

Two coordinated improvements to how Memex captures and retrieves agent context:

1. **Write path standardization** (`cortex-structured-writes`): All `logInsight` calls from the cortex hook must emit structured events — with a consistent summary format, event type semantics, and semantic tags — matching the output quality of the `@memex/afferent` synapse.

2. **Read path fan-out** (`cortex-context-fanout`): `getContext` must issue multiple parallel recall queries — one for the raw tool input, plus secondary queries for agent identity and project context — so that identity and intent memories are returned even when the tool input is semantically distant from stored insights.

## Why

The memory system is only useful if what goes in is queryable and what comes out is relevant. Both sides are currently broken for a class of important queries:

- **Write**: The cortex pre-tool-use hook logs raw, unstructured strings. No agent identity tag, no event type, no consistent format. These entries embed poorly and are hard to recall.
- **Read**: `getContext` queries LTM with `JSON.stringify(toolInput)` — a file path or command string. Insights like "User is building a memory SDK" have near-zero cosine similarity to `{"file_path":"/tmp/cortex.log"}` and are never returned.

An agent asking "who am I" or "what am I building" receives no context from memory, even when that context was previously recorded.

## Scopes

- `packages/cortex` — both changes live here
  - Write: hook integration and `logInsight` call sites
  - Read: `getContext` in `packages/cortex/src/ipc/handlers.ts`

## Sequencing

`cortex-structured-writes` should land first. Once the write path produces consistent `observation`-tagged insights, Phase 2 of `cortex-context-fanout` can layer on tag-filtered recall for higher precision. The fan-out (Phase 1) works independently and can ship before writes are standardized.

## Shared Contracts

- Tags written by the structured write path (`observation`, `navigation`, `screen-state`, `lifecycle`, `tool:<name>`, `agent:<name>`) are the same tags that the read path fan-out (Phase 2) will filter on.
- Both changes rely on `LtmQueryOptions.tags` being already supported in the LTM engine (confirmed: no schema changes required).
