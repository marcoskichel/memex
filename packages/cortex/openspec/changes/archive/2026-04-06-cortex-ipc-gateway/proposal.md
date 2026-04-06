## Why

Cortex runs the full Memory system but has no external interface — its `MemoryEventEmitter` broadcasts internally only, and nothing outside the process can query or observe it. A Unix domain socket server makes cortex the single gateway for all memory operations.

## What Changes

- Cortex creates a Unix domain socket at `/tmp/memex-<sessionId>.sock` on startup and removes it on shutdown
- An NDJSON protocol handles request/response messages (`logInsight`, `getContext`, `recall`, `getStats`) and push messages (all `MemoryEvents` broadcast to every connected client)
- All `MemoryEvent` emissions are forwarded to connected socket clients in real-time
- `getContext` replaces the hook's dumb file-read: cortex runs semantic LTM recall + blends recent context, returning ranked relevant content

## Capabilities

### New Capabilities

- `cortex-socket-server`: Unix domain socket lifecycle — create on startup, accept concurrent connections, remove on shutdown
- `cortex-ipc-protocol`: NDJSON request/response and push message schema for all cortex operations
- `cortex-event-broadcast`: Fan-out of all MemoryEvents to every connected socket client

### Modified Capabilities

## Impact

- `packages/cortex/src/ipc/` — new module with socket server, protocol types, message handlers
- `cortex-core.ts` — starts socket server alongside Memory, threads events through broadcast
- No changes to Memory internals (LTM, STM, Amygdala, Hippocampus)
