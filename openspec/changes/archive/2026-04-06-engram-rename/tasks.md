# Tasks: engram-rename

- [x] Rename `sessionId` → `engramId` in `nuclei/cortex-ipc/src/protocol.ts` and update `IPC_SOCKET_PATH` parameter name
- [x] Rename `sessionId` → `engramId` in `nuclei/axon/src/axon-client.ts` constructor and all internal usages
- [x] Rename `sessionId` → `engramId` in `nuclei/memory/src/memory-types.ts` (`MemoryConfig`, `ShutdownReport`)
- [x] Rename `sessionId` → `engramId` in `nuclei/memory/src/memory-factory.ts` and `memory-impl.ts`
- [x] Rename `sessionId` → `engramId` in `nuclei/stm/src/context-manager.ts`
- [x] Rename `sessionId` → `engramId` in `nuclei/amygdala/src/amygdala-process.ts` and `apply-action.ts`
- [x] Rename `sessionId` → `engramId` in `nuclei/hippocampus` source and test files
- [x] Rename `sessionId` → `engramId` in `nuclei/ltm` source files
- [x] Rename `MEMEX_SESSION_ID` → `NEUROME_ENGRAM_ID` and `sessionId` → `engramId` in `synapses/cortex/src/bin/cortex-core.ts` and `ipc/handlers.ts`
- [x] Rename `MEMEX_SESSION_ID` → `NEUROME_ENGRAM_ID` and `sessionId` → `engramId` in `synapses/dendrite/src/bin/dendrite.ts` and `server.ts`
- [x] Rename `sessionId` → `engramId` in `synapses/afferent/src/index.ts`
- [x] Rename `sessionId` → `engramId` in `synapses/neurome-tui/src/bin/neurome-tui.ts` and `client/socket-client.ts`
- [x] Update all test files across all packages to use `engramId`
- [x] Run `pnpm check` and fix any remaining references or type errors
