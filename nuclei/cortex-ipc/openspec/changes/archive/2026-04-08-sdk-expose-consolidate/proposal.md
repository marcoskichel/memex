# sdk-expose-consolidate — cortex-ipc

## What

Extend `ConsolidatePayload` with an optional `target` field.

## Changes

- `ConsolidatePayload`: add `target?: 'amygdala' | 'hippocampus' | 'all'`
- Default behavior when `target` is omitted: `'all'` (backwards-compatible)
