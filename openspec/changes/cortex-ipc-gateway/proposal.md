# cortex-ipc-gateway

## Why

The memory system currently has two disconnected communication paths: hooks write directly to SQLite and read context files from disk, while the `MemoryEventEmitter` inside cortex emits events that go nowhere externally. This makes real-time observation impossible and splits write authority across processes. A Unix domain socket server on cortex creates a single path — hooks become thin clients, events become observable, and a TUI becomes possible.

## What Changes

- **cortex** gains a Unix domain socket server (`/tmp/memex-<sessionId>.sock`) that exposes the full `Memory` API externally via NDJSON protocol
- **cortex** broadcasts all `MemoryEvents` to every connected client in real-time
- **claude-hooks** `post-tool-use` drops direct SQLite writes; sends insight payload to cortex via socket
- **claude-hooks** `pre-tool-use` drops direct file reads; requests semantically relevant context from cortex via socket (cortex runs LTM recall, not just last-N-files)
- **memex-tui** is a new synapse — an Ink-based TUI that connects to the socket, subscribes to the event stream, and provides an interactive query REPL
- **BREAKING**: hooks now require cortex to be running; if cortex is down, insights are not logged and context injection returns empty

## Capabilities

### New Capabilities (cortex scope)

- `cortex-socket-server`: Unix domain socket lifecycle (create, accept connections, cleanup on shutdown)
- `cortex-ipc-protocol`: NDJSON message protocol — request/response for logInsight, getContext, recall, getStats; push for events
- `cortex-event-broadcast`: Fan-out of all MemoryEvents to connected socket clients

### New Capabilities (claude-hooks scope)

- `hook-socket-client`: Thin socket client used by both hook binaries; handles connect, send, optional response, 50ms timeout

### New Capabilities (memex-tui scope)

- `tui-socket-client`: Persistent socket client with reconnect logic and event subscription
- `tui-layout`: Three-pane Ink layout — events feed, stats panel, query REPL
- `tui-query-repl`: Interactive recall interface with result navigation and full-record expansion

## Impact

- `packages/cortex`: new `src/ipc/` module; `cortex-core.ts` starts socket server alongside Memory
- `synapses/claude-hooks`: `insight-writer.ts`, `context-file-writer.ts`, `context-reader.ts` replaced by `cortex-socket-client.ts`; hook binaries simplified
- `synapses/memex-tui`: new package — Ink, React, `@memex/memory` types as devDep for protocol types
- Operational: cortex must be running before hooks fire; documented as hard requirement
