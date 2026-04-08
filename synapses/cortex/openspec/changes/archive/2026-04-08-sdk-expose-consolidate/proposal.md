# sdk-expose-consolidate — cortex

## What

Pass `target` from the IPC payload through to `memory.consolidate()` in the request handler.

## Changes

- `handlers.ts`: in the `'consolidate'` case, pass `message.payload.target` to `memory.consolidate()`
