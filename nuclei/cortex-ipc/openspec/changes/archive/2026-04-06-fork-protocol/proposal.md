# fork-protocol

## Why

Agents need to snapshot their current memory database at any point during execution, producing an independent copy another agent can fork from. This requires a `fork` IPC command so app code can trigger the operation programmatically through the existing IPC channel without reaching into cortex internals.

## What Changes

- Add `'fork'` to `REQUEST_TYPES`
- Add `ForkPayload` type: `{ outputPath: string }`
- Add `fork` entry to `RequestPayloadMap`: `fork: ForkPayload`
- Response carries the standard `ResponseMessage` shape; `result` is `{ forkPath: string }`
- Export `ForkPayload` from the package index

## Impact

- Additive — no changes to existing request types or response shapes
- All axon consumers gain access to the new command once `@neurome/axon` exposes it
