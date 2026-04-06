## 1. Scoring Process

- [ ] 1.1 Define `AmygdalaConfig`: `{ ltm, stm, llmClient, cadenceMs?, maxBatchSize? }`
- [ ] 1.2 Implement `processEntry(entry)`: read contextFile → query LTM (strengthen: false) → call LLM → determine action (insert/relate/skip) → write to LTM → markProcessed
- [ ] 1.3 Implement `AmygdalaProcess`: start/stop with interval, processes unprocessed entries in batches
- [ ] 1.4 Implement retry: if LTM unavailable, entry stays unprocessed for next cycle
- [ ] 1.5 Write unit tests with mocked LLM client: insert path, relate path (supersedes/elaborates/contradicts), skip path, retry on LTM failure
- [ ] 1.6 Export from `src/index.ts`: `AmygdalaProcess`, `AmygdalaConfig`
