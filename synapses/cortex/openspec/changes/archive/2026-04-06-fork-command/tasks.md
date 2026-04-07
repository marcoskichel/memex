# Tasks: fork-command

- [x] Add `fork` case to `dispatch` switch in `synapses/cortex/src/ipc/handlers.ts`
- [x] Handler calls `memory.fork(payload.outputPath)` and returns `{ forkPath }`
- [x] Add `fork` to `Memory` interface in `nuclei/memory/src/memory-types.ts`
- [x] Implement `Memory.fork()` in `MemoryImpl` via `forkFn` dep
- [x] Add `fork(outputPath: string): Promise<string>` to `SqliteAdapter`
- [x] Wire `forkFn` through `MemoryImplDeps` in `memory-factory.ts`
- [x] Export `ForkPayload` from cortex local `protocol.ts`
- [x] Build and tests pass
