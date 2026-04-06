## Context

`afferent` currently manages its own socket: a persistent `net.Socket`, a pre-connect queue, and reconnect-on-error logic. This is being extracted into `@memex/axon`. What remains in `afferent` after the migration is the domain layer: `AgentEvent` types, the `summaryFor`/`extraTagsFor`/`buildFrame` translation functions, and the fire-and-forget `emit` semantic.

## Goals / Non-Goals

**Goals:**

- Remove socket/transport code from `afferent`, delegate to `@memex/axon`
- Preserve the public API exactly: `createAfferent(sessionId)` → `{ emit, disconnect }`
- Preserve fire-and-forget semantics and the pre-connect queue behavior

**Non-Goals:**

- Changing the `AgentEvent` taxonomy
- Changing tagging or summary logic
- Any API changes visible to callers

## Decisions

**Retain the queue in `afferent`, not in `axon`**
`afferent` queues events before the socket connects. `axon` does not have a domain-level queue — it has connection management. The queue in `afferent` is domain logic (don't lose agent events), not transport logic. It stays in `afferent`. `afferent` will use `axon`'s fire-and-forget `logInsight` once connected.

**`createAfferent` stays synchronous**
Callers do `const aff = createAfferent(sessionId)` then `aff.emit(event)`. This must remain synchronous. `axon` connects lazily on first use, which preserves this.

## Risks / Trade-offs

**[Risk]** axon's reconnect behavior differs from afferent's current logic → Mitigation: axon's reconnect is transparent; afferent's queue drains on connect regardless of who manages the socket.

## Migration Plan

1. Add `@memex/axon` dependency.
2. Replace internal socket/queue with `axon` instance + local pre-connect queue over axon's lazy connect.
3. `emit` calls `axon.logInsight(frame)` in fire-and-forget mode.
4. `disconnect` calls `axon.disconnect()`.
5. Delete `node:net` import and socket management code.
