## Why

The `Memory` interface needs two new methods to expose the capabilities added by `ltm-schema-extensions`: session-scoped retrieval (`recallSession`) and full-episode retrieval including the inline summary (`recallFull`). The factory also needs to forward `sessionId` to `AmygdalaConfig`.

## What Changes

- `Memory` interface gains `recallSession(sessionId: string, query: string, options?: LtmQueryOptions): Promise<LtmQueryResult[]>`
- `Memory` interface gains `recallFull(id: string): Promise<{ record: LtmRecord; episodeSummary: string | null }>`
- `MemoryImpl.createMemory()` forwards `sessionId` from `MemoryConfig` to `AmygdalaConfig`
- `MemoryConfig` gains `sessionId: string` as a required field

## Capabilities

### New Capabilities

- `memory-session-recall`: agent-facing `recallSession()` scoping retrieval to the current or any named session
- `memory-full-episode`: agent-facing `recallFull()` returning a record plus its inline episode summary

### Modified Capabilities

- `memory-orchestration`: `MemoryConfig` gains required `sessionId`; factory wires it to amygdala

## Impact

- `packages/memory`: `memory.ts` (interface), `memory-impl.ts`, `memory-factory.ts`, `memory-types.ts`
- **BREAKING**: `MemoryConfig` gains required `sessionId`; existing callers must pass it
- Requires all other `ltm-schema-extensions` scope changes to be merged first
