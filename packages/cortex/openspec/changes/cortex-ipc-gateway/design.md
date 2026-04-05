## Context

Cortex is a long-lived Node.js daemon that owns the full Memory stack (STM, Amygdala, Hippocampus, LTM). It currently has no external interface — no IPC, no HTTP, no way for other processes to subscribe to its event stream or submit operations. Hooks write directly to SQLite, bypassing cortex entirely. The `MemoryEventEmitter` inside the Memory instance emits events that go nowhere.

## Goals / Non-Goals

**Goals:**

- Expose cortex's Memory API over a Unix domain socket using NDJSON
- Broadcast all MemoryEvents to all connected clients in real-time
- Own the `getContext` operation: semantic LTM recall + recent context blended, replacing the hook's dumb last-N-files read
- Support concurrent clients (hooks fire frequently; TUI is persistent)

**Non-Goals:**

- Authentication or authorization on the socket (local process trust)
- HTTP or TCP — Unix sockets only (local machine, no network overhead)
- Persistent message queue or delivery guarantees for events (fire-and-forget broadcast)

## Decisions

**Unix domain socket over TCP loopback**
Unix sockets are files — faster than loopback TCP, no port management, path encodes the session ID. Alternatives: TCP (port conflicts, harder to discover), named pipes (platform-specific), stdin/stdout (single client only).

**NDJSON over binary protocol**
Each message is one JSON line terminated by `\n`. Simple to implement, human-readable for debugging, no framing complexity. Alternatives: msgpack (binary, faster), protobuf (typed, much more setup), JSON-RPC (overkill).

**Message schema — two message types:**

```
Request  { id: string, type: "logInsight" | "getContext" | "recall" | "getStats", payload: ... }
Response { id: string, ok: true, result: ... } | { id: string, ok: false, error: string }
Push     { type: "event", name: <MemoryEventName>, payload: ... }   ← no id, broadcast only
```

Requests get a correlated response. Events are pushed with no id (no ack needed).

**Socket path: `/tmp/memex-<sessionId>.sock`**
Session ID is already known to all parties (env var `MEMORY_SESSION_ID`). Path is deterministic and collides only if two cortex instances share a session ID (which would be a config error). Removed on shutdown via `process.on('exit')` cleanup.

**`getContext` semantic recall**
Takes `{ sessionId, toolName, toolInput }`. Runs `memory.recall(JSON.stringify(toolInput), { limit: 5 })` and blends top results with the 3 most recent context files still on disk. Returns formatted markdown string — same shape as what pre-tool-use currently writes to stdout.

**Concurrent connection handling**
`net.createServer` in Node.js is inherently async/non-blocking. Each client gets its own socket stream. The server maintains a `Set<net.Socket>` of active clients for event broadcast. On client disconnect, it's removed from the set.

**Event wiring**
After `createMemory()` resolves, the server calls `memory.events.on('*', broadcastToClients)` — but MemoryEventEmitter doesn't support wildcard. Instead: enumerate all known event names from `MemoryEvents` type and register one handler per event that calls `broadcast`. This is a fixed list of ~8 event names, not a scaling concern.

## Risks / Trade-offs

[Socket accept latency under amygdala load] → Node's event loop handles socket accepts between async operations; amygdala cycles are async (`await`-based) so accepts aren't blocked. Tested with 50ms hook timeout: should be fine.

[Socket file left behind on hard crash] → Next cortex startup checks if socket path exists; if a stale socket is found (connect fails immediately), it removes it and creates a new one.

[getContext LTM recall adds latency to pre-tool-use] → pre-tool-use now has a network hop + embedding lookup. The 50ms hook timeout may be too tight for cold-start recall. Consider: lazy embedding on first query, or a longer timeout for getContext specifically (200ms). Flagged as open question.

## Migration Plan

1. Add socket server to cortex — backward compatible (hooks still work against old cortex since they exit 0 on failure)
2. Update hooks to use socket client — requires cortex to be running
3. Deploy cortex first, then update hooks config

Rollback: hooks fall back to exit 0 on socket failure; reverting hook binaries restores current behavior.
