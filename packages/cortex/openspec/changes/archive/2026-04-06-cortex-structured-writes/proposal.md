## Why

The cortex pre-tool-use hook logs raw, unstructured strings to `logInsight` with no agent identity, no event type, and no semantic tags. These entries embed poorly and are nearly impossible to recall via semantic search, defeating the purpose of the memory system.

## What Changes

- The cortex hook integration MUST translate each intercepted tool call into a structured `TOOL_CALL`-style event before calling `logInsight`, producing a human-readable summary and semantic tags identical in format to what `@memex/afferent` emits.
- `logInsight` payloads from the cortex hook MUST include tags: `tool:<toolName>`, `navigation`, and `agent:claude` (or equivalent session-scoped identity).
- Summary format MUST follow: `Tool called: <toolName> — <serialized input>` (truncated to 500 chars).
- A `run:<runId>` tag MUST be included and remain stable for the lifetime of the cortex session.

## Capabilities

### New Capabilities

- `structured-hook-events`: The cortex hook emits structured, tagged `logInsight` payloads for every intercepted tool call, matching the afferent event model.

### Modified Capabilities

(none — cortex has no existing specs)

## Impact

- `packages/cortex/src/bin/cortex-core.ts` — hook registration and logInsight call sites
- `packages/cortex/src/ipc/handlers.ts` — `logInsight` handler (no interface change, payload enrichment only)
- No changes to `@memex/afferent` — it is already correct and serves as the reference implementation
- No changes to `@memex/ltm` schema — tags are stored in `metadata.tags`, already supported
