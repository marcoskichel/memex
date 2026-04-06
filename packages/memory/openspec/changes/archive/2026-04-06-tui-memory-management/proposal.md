## Why

The TUI needs to write memories directly to LTM, ingest free-text via LLM, and browse recent records. None of these are exposed on the `Memory` interface today.

## What Changes

- `Memory` interface gains three new methods
- `memory-impl.ts` implements all three

## Capabilities

### New Capabilities

- `memory-insert`: `insertMemory(data, options?)` — direct LTM write, bypasses STM pipeline, returns record id
- `memory-import-text`: `importText(text)` — uses LLM adapter to extract discrete memories from free text, bulk-inserts to LTM, returns `{ inserted: number }`
- `memory-get-recent`: `getRecent(limit)` — returns latest N LTM records sorted by creation date, no embedding required

## Impact

- `packages/memory/src/memory-types.ts` — interface additions
- `packages/memory/src/memory-impl.ts` — implementations
