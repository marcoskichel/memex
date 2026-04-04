## 1. Insight Log

- [ ] 1.1 Define `InsightEntry` type: `{ id, summary, contextFile, tags, timestamp, processed }`
- [ ] 1.2 Implement `InsightLog` class: `append()`, `readUnprocessed()`, `markProcessed(ids[])`, `clear()`
- [ ] 1.3 In-memory storage only (array + processed flag); no persistence
- [ ] 1.4 Write unit tests: append, readUnprocessed ordering, markProcessed, clear retains unprocessed

## 2. Context Compression

- [ ] 2.1 Define `Phase` type: `{ toolCall, toolResult, agentReaction }` (strings)
- [ ] 2.2 Implement `compress(phase, contextDir)`: saves full raw phase to context file, returns `{ compressed: string, insight: InsightEntry }`; compression itself is a pluggable async function (caller provides the LLM compress fn)
- [ ] 2.3 Implement `ContextManager`: tracks token usage, triggers compression at threshold (default 70%), flushes on session end
- [ ] 2.4 Write unit tests: context file written before compression, insight entry produced, flush on session end, threshold trigger
- [ ] 2.5 Export from `src/index.ts`: `InsightLog`, `ContextManager`, `compress`, all types
