# mcp-access-mode

## What

Introduce `accessMode` to `asMcpServer()` on the `Engram` SDK class, enabling consumers to opt into a writable MCP server. When `accessMode: 'full'` is set, the dendrite MCP server exposes a `log_insight` tool that allows an AI agent to log observations into memory. Default behavior (`'read-only'`) is unchanged.

## Why

The dendrite MCP server is currently read-only — it exposes `recall`, `get_context`, `get_recent`, and `get_stats` but no write surface. An AI agent that only reads memory cannot record what it observes during a session. `logInsight` already exists end-to-end (SDK → axon → cortex → STM), but is not reachable via MCP. Exposing it conditionally (opt-in) avoids giving untrusted agents write access by default.

## Scopes

- **sdk** — add `McpAccessMode` type and `McpServerOptions` interface; update `asMcpServer()` to accept options and pass `NEUROME_ACCESS_MODE` env var
- **dendrite** — read `NEUROME_ACCESS_MODE` in bin; thread `accessMode` through `run()` and `createServer()`; register `log_insight` tool when `accessMode === 'full'`

## Shared contract

`NEUROME_ACCESS_MODE` env var is the bridge between scopes. Values: `'read-only'` (default) | `'full'`.

The `log_insight` MCP tool signature:

- Input: `{ insight: string }`
- Maps to: `axon.logInsight({ summary: insight, contextFile: '' })`
- Returns: `{ logged: true }`
