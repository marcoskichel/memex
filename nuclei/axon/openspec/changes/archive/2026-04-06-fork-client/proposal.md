# fork-client

## Why

`AxonClient` needs to expose the `fork` IPC command so SDK consumers and `@neurome/sdk` can trigger database snapshots programmatically without constructing raw IPC frames.

## What Changes

- Add `fork(outputPath: string, timeoutMs?: number): Promise<string>` to `AxonClient`
- Sends `{ type: 'fork', payload: { outputPath } }` over the IPC socket
- Returns the confirmed `forkPath` from the response
- Default timeout consistent with other read operations

## Impact

- Additive — new method on `AxonClient`, no breaking changes
