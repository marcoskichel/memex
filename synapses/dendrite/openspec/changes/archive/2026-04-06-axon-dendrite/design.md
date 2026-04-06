## Context

`dendrite` is a new MCP server synapse. AI agents that speak MCP (Model Context Protocol) have no way to query the memory system. The cortex IPC exposes `recall`, `getContext`, `getRecent`, and `getStats` but these are only reachable over the Unix socket. `dendrite` bridges the MCP protocol to the cortex IPC using `@memex/axon`.

## Goals / Non-Goals

**Goals:**

- MCP server exposing four read-only memory tools
- Session configured once at startup via `MEMEX_SESSION_ID`
- Runnable as a standalone process (`npx @memex/dendrite` or via MCP config)

**Non-Goals:**

- Write operations (logInsight, insertMemory, importText — that is `afferent`)
- Authentication or multi-tenant session routing
- Streaming responses

## Decisions

**Session ID from env var, not per-tool-call**
`MEMEX_SESSION_ID` is read at startup. The server connects to that session's socket and serves all tool calls against it. Per-call session routing was considered and rejected — MCP servers are typically long-running and session-scoped.

**`@modelcontextprotocol/sdk` for MCP transport**
The official SDK handles stdio MCP transport, tool registration, and schema validation. No custom MCP plumbing needed.

**Tool names use snake_case**
MCP tool names: `recall`, `get_context`, `get_recent`, `get_stats`. Snake_case matches MCP convention.

**Tool inputs map 1:1 to axon method signatures**
`recall` takes `{ query: string, options?: RecallOptions }`. `get_context` takes `{ tool_name: string, tool_input: unknown, category?: string }`. `get_recent` takes `{ limit: number }`. `get_stats` takes no input.

**Errors surface as MCP tool errors, not process crashes**
Axon errors (timeout, socket unavailable) are caught and returned as MCP `isError: true` responses. The server process stays alive.

## Risks / Trade-offs

**[Risk]** Cortex not running when dendrite starts → Mitigation: axon connects lazily; dendrite starts successfully and returns errors on tool calls until cortex is available.

**[Risk]** `MEMEX_SESSION_ID` not set → Mitigation: dendrite exits with a clear error message at startup.

## Migration Plan

New package — no migration needed. Add to MCP client config with:

```json
{ "command": "npx", "args": ["@memex/dendrite"], "env": { "MEMEX_SESSION_ID": "<id>" } }
```
