## Context

Dendrite is a standalone stdio subprocess spawned by the SDK via `asMcpServer()`. It receives configuration exclusively through env vars at startup. The SDK passes `NEUROME_ACCESS_MODE` to control which MCP tools are registered. The dendrite server currently calls `createServer(axon, engramId)` with a fixed tool set.

## Goals / Non-Goals

**Goals:**

- Conditionally register `log_insight` tool when `NEUROME_ACCESS_MODE=full`
- Keep the default (no env var or `read-only`) identical to current behavior
- Map a single string input to `axon.logInsight({ summary, contextFile: '' })`

**Non-Goals:**

- Per-request access control (mode is fixed at startup)
- Exposing `insertMemory` or other write operations at this time

## Decisions

**Thread `accessMode` as a parameter rather than re-reading env in `server.ts`**
Keeps `server.ts` pure and testable — `createServer` takes explicit arguments, not ambient env. The bin entry point is the single place that reads env vars.

**`contextFile: ''` for MCP-originated insights**
No file context exists in the MCP call context. Empty string is the established pattern (see `synapses/afferent`); amygdala handles it gracefully.

**Fire-and-forget, return `{ logged: true }` immediately**
`logInsight` is void — no awaiting needed. The tool handler returns synchronously rather than introducing false async.

**Unrecognized `NEUROME_ACCESS_MODE` values fall back to `'read-only'`**
Fail-safe: unknown values should not accidentally enable write tools.

## Risks / Trade-offs

- [No acknowledgement from `logInsight`] → The MCP caller receives `{ logged: true }` but cannot confirm the insight was processed; this matches the fire-and-forget contract of `logInsight` throughout the system
- [Access mode is set at startup] → No way to change mode without restarting dendrite; acceptable for current use cases
