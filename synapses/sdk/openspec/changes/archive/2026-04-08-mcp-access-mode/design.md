## Context

`Engram.asMcpServer()` returns a `McpServerConfig` that spawns the dendrite subprocess via stdio. The only bridge between the SDK and dendrite at startup is environment variables. No runtime communication channel exists — the config is static once created.

## Goals / Non-Goals

**Goals:**

- Allow consumers to opt into write-capable MCP tools via a typed API
- Keep default behavior unchanged (read-only)
- Propagate the access mode to dendrite via an env var

**Non-Goals:**

- Runtime access mode switching (mode is set at server startup, not per-request)
- Fine-grained per-tool toggles (single `accessMode` covers all write tools)

## Decisions

**Use an `accessMode` option on `asMcpServer()` rather than a separate method**
A single options object is more extensible than proliferating method variants (`asReadOnlyMcpServer`, `asWritableMcpServer`). Future options (e.g., `serverName`, `timeout`) compose cleanly.

**Propagate via `NEUROME_ACCESS_MODE` env var**
The only established bridge between SDK and dendrite is env vars (see `NEUROME_ENGRAM_ID`, `MEMORY_DB_PATH`). Consistent with the existing pattern. No new IPC mechanism needed.

**Default to `'read-only'`**
Write access must be explicit. An opt-in model avoids accidentally giving untrusted agents write capability.

## Risks / Trade-offs

- [Env var is stringly typed at the subprocess boundary] → Dendrite validates the value and falls back to `'read-only'` on unrecognized input
- [No runtime enforcement in SDK] → The access mode only gates what tools dendrite registers; the `Engram` class itself is unaffected
