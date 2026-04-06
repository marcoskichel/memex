## Why

`afferent` currently owns its own Unix socket implementation (persistent connection, queue, reconnect logic). With `@memex/axon` extracted as the shared transport, this is duplication that should be removed.

## What Changes

- Remove the internal socket/queue implementation from `afferent/src/index.ts`.
- Add `@memex/axon` as a dependency and delegate all socket I/O to it.
- Retain the `AgentEvent` domain abstraction, `summaryFor`, `extraTagsFor`, `buildFrame`, and the fire-and-forget queuing semantic — these are afferent's reason to exist.
- Public API (`createAfferent`, `emit`, `disconnect`) is unchanged.

## Capabilities

### New Capabilities

### Modified Capabilities

- `agent-event-streaming`: Transport layer replaced by `@memex/axon`. Behavior (AgentEvent → tagged logInsight, fire-and-forget, queue-until-connected) is preserved. No change to callers.

## Impact

- `synapses/afferent/src/index.ts` — socket code removed, replaced with `@memex/axon` calls
- New dependency: `@memex/axon`
- Removed dependency: direct `node:net` socket management
