## Why

The TUI needs IPC access to three new `Memory` methods added in the `memory` scope change. The cortex socket server is the only entry point for external callers.

## What Changes

- Three new entries in `RequestPayloadMap`
- Three new dispatch cases in `handlers.ts`

## Capabilities

### New Capabilities

- `cortex-insert-memory`: IPC handler for direct LTM insertion; payload `{ data, options? }`; returns `{ id: number }`
- `cortex-import-text`: IPC handler for LLM-chunked free-text ingestion; payload `{ text }`; returns `{ inserted: number }`
- `cortex-get-recent`: IPC handler for recency-sorted LTM fetch; payload `{ limit }`; returns `LtmRecord[]`

## Impact

- `packages/cortex/src/ipc/protocol.ts` — payload types + `RequestPayloadMap` entries
- `packages/cortex/src/ipc/handlers.ts` — dispatch cases

## Depends On

- `memory` scope change (tui-memory-management) must land first
