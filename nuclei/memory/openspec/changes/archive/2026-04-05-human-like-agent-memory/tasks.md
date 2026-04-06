## 1. Orchestration

- [ ] 1.1 Define `MemoryConfig`: `{ ltmAdapter, contextDir, llmClient, compressionThreshold?, amygdalaCadenceMs?, hippocampusScheduleMs? }`
- [ ] 1.2 Implement `createMemory(config)`: instantiates LtmEngine, InsightLog, ContextManager, AmygdalaProcess, HippocampusProcess; starts background processes
- [ ] 1.3 Implement `logInsight(summary, contextFile, tags?)`: calls `stm.append()`, triggers compression check
- [ ] 1.4 Implement `recall(nlQuery, options?)`: wraps `ltm.query()` with `strengthen: false` default
- [ ] 1.5 Implement `shutdown()`: synchronous final amygdala pass on remaining STM entries, stops all background processes
- [ ] 1.6 Write integration tests: full round-trip (logInsight → amygdala processes → recall returns result), shutdown flushes STM
- [ ] 1.7 Export from `src/index.ts`: `createMemory`, `MemoryConfig`, `Memory` type
