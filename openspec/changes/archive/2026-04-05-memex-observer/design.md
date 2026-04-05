## Context

Neurokit exposes memory operations via a Unix domain socket IPC server (`@memex/cortex`). Existing consumers (`claude-hooks`) open a fresh connection per call because they run as short-lived hook processes. A persistent observer needs a different connection strategy — one socket held open for the lifetime of the consuming process, with in-memory buffering to cover the window before the connection is established.

External agents use a simple `(event: AgentEvent) => void` callback pattern for observability. The observer must be structurally compatible with this type without importing from the consuming project.

## Goals / Non-Goals

**Goals:**

- Export `createMemexObserver(sessionId)` from a new `synapses/memex-observer` package
- Hold one persistent socket connection per observer instance
- Buffer events received before the socket connects, flush on connect
- Translate each `AgentEvent` variant into a `logInsight` IPC call with meaningful summary and tags
- Degrade silently when cortex is not running

**Non-Goals:**

- Response handling — `logInsight` is fire-and-forget; the observer never reads from the socket
- Reconnection logic — the observer is scoped to the lifetime of a single agent run (a short-lived CLI process); reconnection adds complexity with no benefit here
- Awareness of qa-agents or any specific consumer — the package must not import from external repos

## Decisions

**Persistent connection over per-call connections**
The observer callback fires 40-60 times per typical agent run. Opening a new Unix socket per event adds unnecessary overhead and risks connection exhaustion. One connection per observer instance is the right model.

Alternative considered: reuse the `withSocketTimeout` pattern from `claude-hooks`. Rejected — that pattern is designed for fire-and-call-and-close semantics, not streaming.

**Queue-then-flush for pre-connect events**
`createConnection` is async; the first events fire before `connect` is emitted. A simple string queue accumulates frames until connected, then flushes in order. This is simpler than deferring socket creation until first event.

Alternative considered: lazy connect on first event. Rejected — still has the same race; the queue approach is cleaner.

**Structural compatibility over shared types**
The package defines its own `AgentEvent` interface locally. TypeScript's structural typing means the returned function is assignable to any `AgentObserver` type with a compatible shape, without importing from the consumer's package.

Alternative considered: publish `AgentEvent` as a shared package both repos depend on. Rejected — unnecessary coupling for a type this simple.

**`TOOL_RESULT` truncation at 500 chars**
Accessibility tree snapshots can be several KB. The meaningful signal is the agent's `THOUGHT` interpretation of the tree, not the raw tree itself. Truncating `TOOL_RESULT` keeps STM entries lean without losing the important information.

**Silent error handling**
`socket.on('error', () => {})` prevents uncaught exceptions when cortex is not running. The consuming agent must not be affected by memory system availability.

## Risks / Trade-offs

[Events lost if cortex is not yet started when the observer is created] → Acceptable — events are buffered until connect. If cortex never starts, events are dropped silently, which is the intended degradation behaviour.

[No reconnection on socket drop mid-run] → Acceptable for now — agent runs are short-lived CLI processes. If the socket drops mid-run, subsequent events are silently dropped. A future `dispose()` pattern or reconnect loop can address this if needed.

[Tag-based filtering is primitive] → The hippocampus consolidation handles deduplication and relevance; the observer's job is to emit faithfully, not to curate.

## Open Questions

- Should `TOOL_RESULT` for non-snapshot tools (e.g. `tap`, `scroll`) also be truncated, or only for `accessibility_snapshot`? Currently all results are truncated at 500 chars.
- Should the package name be `@memex/observer` or `@memex/agent-observer` to distinguish it from the qa-agents `@qa-agents/observer` package?
