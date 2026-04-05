## Context

Both hook binaries (`post-tool-use`, `pre-tool-use`) spawn as short-lived processes per tool call. They currently write directly to SQLite (post) and read files from disk (pre). With the cortex socket available, they become thin clients: connect, send one message, optionally read one response, exit.

## Goals / Non-Goals

**Goals:**

- Replace all direct SQLite and filesystem operations in hooks with socket calls
- Keep hooks non-blocking — 50ms hard timeout, exit 0 on any failure
- Share socket client code between both binaries

**Non-Goals:**

- Retry logic (one attempt only — hooks must be fast)
- Buffering insights locally when cortex is down (explicit non-goal: cortex is a hard requirement)

## Decisions

**Single `CortexSocketClient` module shared by both bins**
Both hooks do the same thing: connect to `/tmp/memex-<sessionId>.sock`, send one NDJSON line, optionally read one response line. Extracting this into `src/shell/clients/cortex-socket-client.ts` avoids duplication and keeps the timeout logic in one place.

**50ms connect timeout, no response timeout for logInsight**
`logInsight` is fire-and-forget from the hook's perspective — cortex acks but the hook doesn't wait. The 50ms covers the connect + write. `getContext` needs a response, so it uses a 200ms timeout (longer, but pre-tool-use latency budget is less critical than post-tool-use).

**`@memex/stm` dependency removed**
Hooks no longer open SQLite directly. The `insight-writer.ts`, `context-file-writer.ts`, `context-reader.ts` files are deleted. This simplifies the package significantly.

**Socket path derived from env, fallback to payload session ID**
`MEMORY_SESSION_ID` env var → socket path. If unset, use `payload.session_id` (same logic as before). If neither is available, exit 0 silently.

## Risks / Trade-offs

[Cortex down → insights silently dropped] → Documented as hard requirement: cortex must be running. A startup script or launchd/systemd service ensures this.

[getContext latency for pre-tool-use] → 200ms timeout. If cortex is under load during an amygdala cycle, getContext may time out and return empty context. Acceptable degradation.
