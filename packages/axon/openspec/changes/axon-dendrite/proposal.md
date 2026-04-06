## Why

Every synapse that talks to cortex has hand-rolled its own socket code — `afferent` has a persistent queue-based client, `claude-hooks` has ad-hoc connections with hardcoded correlation IDs and silent timeout swallowing. There is no shared, typed, reliable IPC client. `@memex/axon` fixes this once.

## What Changes

- New package `packages/axon` (`@memex/axon`) implementing a typed async IPC client for the cortex daemon.
- Persistent Unix socket connection with automatic reconnect.
- Request/response correlation by UUID, proper error propagation.
- Typed async methods for all cortex operations: `recall`, `getContext`, `getRecent`, `getStats`, `logInsight`, `insertMemory`, `importText`, `consolidate`.
- All protocol types imported from `@memex/cortex`.

## Capabilities

### New Capabilities

- `ipc-client`: Typed async client connecting to `/tmp/memex-<sessionId>.sock`, tracking in-flight requests by UUID, exposing all cortex IPC operations as typed async methods with proper error propagation.

### Modified Capabilities

## Impact

- New package: `packages/axon/`
- Depends on: `@memex/cortex` (protocol types, `IPC_SOCKET_PATH`)
- Depended on by: `@memex/afferent`, `@memex/claude-hooks`, `synapses/dendrite`
