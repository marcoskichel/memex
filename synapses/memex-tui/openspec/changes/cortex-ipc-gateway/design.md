## Context

No tool currently exists to observe the memory system at runtime. The TUI is a new synapse built on Ink (React for terminals — the same library Claude Code uses). It connects to the cortex socket as a persistent client, subscribes to the event push stream, and exposes an interactive query REPL.

## Goals / Non-Goals

**Goals:**

- Real-time event feed showing all MemoryEvents as they arrive
- Stats panel updated on a 2-second poll via `getStats`
- Interactive query REPL: natural-language recall, result navigation, full-record detail
- Works when no agent is active (TUI can query a session that is idle)

**Non-Goals:**

- Modifying memory (no insert, no delete — read and query only from TUI)
- Multiple session support in one TUI instance (one socket connection = one session)
- Mouse support

## Decisions

**Ink + React**
Ink renders React components to the terminal. It handles layout (`<Box>`), styled text (`<Text>`), keyboard input (`useInput`), and terminal dimensions (`useStdout`). Claude Code uses it — same ecosystem, same mental model. Alternative: Blessed (heavier, less idiomatic); raw ANSI (no component model).

**Three-pane layout**

```
┌──────────────────────┬────────────────────────┐
│ EVENTS (scrolling)   │ STATS (polled 2s)       │
│                      │                         │
│                      │                         │
├──────────────────────┴────────────────────────┤
│ QUERY REPL (input + results)                   │
└───────────────────────────────────────────────┘
```

`tab` cycles focus between panes. The events pane uses Ink's `<Static>` for the scrolling log (renders appended items without re-rendering history). Stats pane is a simple table updated on state change.

**Persistent socket client with reconnect**
Unlike hooks (one-shot), the TUI maintains a persistent connection. If the socket closes (cortex restarted), the client attempts reconnect on a 2-second backoff up to 10 times, then shows a "reconnecting..." banner. This handles cortex restart without requiring TUI restart.

**Query REPL state machine**

```
idle → typing → submitted → showing results → detail view → idle
```

`enter` submits the query. Arrow keys navigate results. `enter` on a result fetches full record. `esc` returns to result list, then to idle.

**Event fan-in into a bounded ring buffer**
The events pane holds the last 200 events in a ring buffer (array with max-length enforcement). Each push event from the socket appends to the buffer and triggers a re-render. Older events scroll off the top via `<Static>`.

**No direct `@memex/memory` package dependency**
The TUI only needs the TypeScript types for the IPC protocol and `MemoryStats`. These will be defined in a shared `protocol.ts` in the cortex IPC module and re-exported. The TUI imports types only — no runtime dependency on the full memory stack.

## Risks / Trade-offs

[Ink version compatibility with Node ESM] → Ink 5.x is ESM-native. The monorepo uses `"type": "module"`. Should be compatible; verify during implementation.

[High event volume flooding the render loop] → Amygdala cycles can emit many events rapidly. Batch renders: debounce state updates at 50ms rather than re-rendering on every single event push.

[getStats polling adding socket load] → 2-second interval × one `getStats` call. Negligible — cortex handles this synchronously.
