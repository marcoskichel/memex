## 1. Consolidation Process

- [ ] 1.1 Define `HippocampusConfig`: `{ ltm, llmClient, scheduleMs?, similarityThreshold?, minClusterSize?, minAccessCount? }`
- [ ] 1.2 Implement `consolidationPass()`: findConsolidationCandidates → filter clusters ≥ minClusterSize → LLM summarize each → ltm.consolidate per cluster
- [ ] 1.3 Implement `pruningPass()`: ltm.prune({ minRetention: 0.1 })
- [ ] 1.4 Implement `HippocampusProcess`: start/stop with interval; runs consolidation then pruning; advisory lock flag prevents overlap with amygdala
- [ ] 1.5 Verify idempotency: running twice on same data produces same result
- [ ] 1.6 Write unit tests with mocked LLM: consolidation pass clusters and merges correctly, pruning removes low-retention records, advisory lock prevents double-run
- [ ] 1.7 Export from `src/index.ts`: `HippocampusProcess`, `HippocampusConfig`
