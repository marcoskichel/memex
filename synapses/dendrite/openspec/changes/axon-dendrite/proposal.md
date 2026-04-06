## Why

AI agents that speak MCP have no way to query the memory system. Read operations (`recall`, `getContext`, `getRecent`, `getStats`) exist over the cortex IPC but are unreachable from the MCP protocol layer. `dendrite` bridges this gap — named for the receiving end of the axon→dendrite signal pathway.

## What Changes

- New synapse `synapses/dendrite` implementing an MCP server.
- Exposes four read-only tools: `recall`, `get_context`, `get_recent`, `get_stats`.
- Uses `@memex/axon` as transport — no direct socket code.
- Session ID configured via `MEMEX_SESSION_ID` env var at startup.
- Write operations are explicitly out of scope — that is `afferent`'s responsibility.

## Capabilities

### New Capabilities

- `memory-mcp-tools`: MCP server exposing `recall`, `get_context`, `get_recent`, `get_stats` as tools. Requires `MEMEX_SESSION_ID` env var. Read-only.

### Modified Capabilities

## Impact

- New package: `synapses/dendrite/`
- Depends on: `@memex/axon`, an MCP SDK (e.g. `@modelcontextprotocol/sdk`)
- Entry point: `bin/dendrite` — runnable as a standalone MCP server process
