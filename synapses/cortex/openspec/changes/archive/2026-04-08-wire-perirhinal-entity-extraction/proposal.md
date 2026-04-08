## Why

The `memory` scope will emit a new `perirhinal:extraction:end` event after each entity extraction run. Cortex must add this event to its broadcast list so connected clients (TUI, SDK observers) can observe entity extraction activity alongside amygdala and hippocampus events.

## What Changes

- Add `perirhinal:extraction:end` to `MEMORY_EVENT_NAMES` in `cortex-core.ts`
- The `MemoryEvents` type in `@neurome/memory` will include the new event — cortex just needs to list it

## Capabilities

### New Capabilities

_(none — this extends an existing capability)_

### Modified Capabilities

- `cortex-event-broadcast`: Add `perirhinal:extraction:end` to the set of events cortex forwards to connected clients

## Impact

- `src/bin/cortex-core.ts` — one-line addition to `MEMORY_EVENT_NAMES`
- No new dependencies, no protocol changes
