## Why

`asMcpServer()` returns a read-only MCP configuration — AI agents using it can recall memory but cannot log observations back. `logInsight` already exists end-to-end but is unreachable via MCP. Exposing it opt-in keeps untrusted agents read-only by default.

## What Changes

- Add `McpAccessMode` type (`'read-only' | 'full'`) to `types.ts`
- Add `McpServerOptions` interface with optional `accessMode` field to `types.ts`
- Update `Engram.asMcpServer()` to accept `options?: McpServerOptions` and pass `NEUROME_ACCESS_MODE` env var to the dendrite subprocess

## Capabilities

### New Capabilities

- `mcp-access-mode`: Consumer-controlled access mode for the MCP server; propagated via env var to the dendrite subprocess

### Modified Capabilities

## Impact

- `synapses/sdk/src/types.ts` — new types
- `synapses/sdk/src/engram.ts` — updated `asMcpServer()` signature
