## Why

The cortex IPC server has no way to trigger a hippocampus consolidation pass remotely. Hook integrations and external tooling (e.g. memex-tui, test harnesses) cannot flush consolidation without restarting the daemon. Adding a `consolidate` IPC request type exposes the `memory.consolidate()` method through the existing socket protocol.

## What Changes

- `RequestMessage` SHALL include a `consolidate` type with an empty payload `{}`.
- The IPC handler SHALL dispatch `consolidate` requests to `memory.consolidate()` and return the `ConsolidationResult` as the response.
- `GetContextPayload` type is not changed.

## Capabilities

### New Capabilities

- `consolidate-ipc`: The cortex socket server accepts `consolidate` requests and triggers a hippocampus consolidation pass, returning the result.

### Modified Capabilities

- (none — adding a new request type is non-breaking)

## Impact

- `packages/cortex/src/ipc/protocol.ts` — add `{ type: 'consolidate'; payload: Record<never, never> }` to `RequestMessage` union
- `packages/cortex/src/ipc/handlers.ts` — add `consolidate` case to `dispatch()`
