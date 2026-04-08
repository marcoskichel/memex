# sdk-expose-consolidate — axon

## What

Extend `AxonClient.consolidate()` to accept and forward the optional `target` to the IPC payload.

## Changes

- `axon-client.ts`: update `consolidate(target?: ConsolidateTarget)` — include `target` in payload when provided
