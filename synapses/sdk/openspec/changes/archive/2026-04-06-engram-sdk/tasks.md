# Tasks: engram-sdk

- [x] Create `synapses/sdk/package.json` — `@neurome/sdk`, not private, deps: axon, cortex, dendrite, better-sqlite3
- [x] Create `synapses/sdk/tsconfig.json`
- [x] Create `synapses/sdk/src/types.ts` — `StartEngramConfig`, `McpServerConfig` interfaces
- [x] Create `synapses/sdk/src/engram.ts` — `Engram` class wrapping `AxonClient`
- [x] Create `synapses/sdk/src/start-engram.ts` — `startEngram()` spawns cortex, handles source fork
- [x] Create `synapses/sdk/src/index.ts` — exports `Engram`, `startEngram`, types
- [x] Create `synapses/sdk/src/bin/cortex.ts` — cortex entry delegating to `@neurome/cortex`
- [x] Create `synapses/sdk/src/bin/dendrite.ts` — dendrite entry delegating to `@neurome/dendrite`
- [x] Export `main` from `@neurome/cortex` index
- [x] Add `exports` field to `@neurome/dendrite` package.json
- [x] Export `InsertMemoryOptions` from `@neurome/axon` index
- [x] Build and tests pass (13/13 packages)
