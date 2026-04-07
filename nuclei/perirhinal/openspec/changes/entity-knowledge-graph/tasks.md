## 1. Package Scaffold

- [ ] 1.1 Set up `src/` directory structure: `core/`, `shell/`, `shell/clients/`
- [x] 1.2 Install `pnpm` workspace dependencies (`@neurome/ltm`, `@neurome/llm`, `neverthrow`)

## 2. Types

- [ ] 2.1 Define `ExtractedEntity`, `ExtractedEdge`, `EntityResolution`, `EntityInsertPlan` types in `core/types.ts`
- [ ] 2.2 Define `ExtractionError` discriminated union covering `LLM_CALL_FAILED`, `STORAGE_FAILED`, `LOCK_FAILED`
- [ ] 2.3 Export all public types from `src/index.ts`

## 3. Core: resolveEntityIdentity

- [ ] 3.1 Implement `resolveEntityIdentity` in `core/entity-resolver.ts`
- [ ] 3.2 Unit tests: exact match, same-type merge (≥0.85), different-type at 0.82, same-type ambiguous band, no candidates

## 4. Core: buildEntityInsertPlan

- [ ] 4.1 Implement `buildEntityInsertPlan` in `core/insert-plan.ts`
- [ ] 4.2 Unit tests: distinct → toInsert, merge/exact → toReuse, llm-needed → llmNeeded, edges passed through

## 5. Core: extractEntitiesFromRecord

- [ ] 5.1 Implement `extractEntitiesFromRecord` in `core/record-extractor.ts` — builds LLM prompt payload from `LtmRecord`
- [ ] 5.2 Unit tests: record with entities metadata, record without entities, edge cases (empty data)

## 6. Shell: LLM client

- [ ] 6.1 Implement `callExtractionLlm` in `shell/clients/extraction-client.ts` using `completeStructured<T>` from `@neurome/llm`
- [ ] 6.2 Implement `callDeduplicationLlm` for batched LLM confirmation of ambiguous candidates
- [ ] 6.3 Unit tests: mock LLM responses for merge and distinct outcomes

## 7. Shell: EntityExtractionProcess

- [ ] 7.1 Implement `EntityExtractionProcess` in `shell/entity-extraction-process.ts`: acquire lock, query unlinked records, run pipeline, write results, release lock
- [ ] 7.2 Implement `persistInsertPlan` — calls `insertEntity`, `insertEntityEdge`, and `insertEntityRecordLink` on `StorageAdapter`
- [ ] 7.3 Export `EntityExtractionProcess` from `src/index.ts`

## 8. Integration Tests

- [ ] 8.1 Integration test: full run with `InMemoryAdapter` — record with entities produces node + link, second run is idempotent
- [ ] 8.2 Integration test: deduplication — two records referencing same entity produces one node and two links
- [ ] 8.3 Integration test: lock contention — second process instance exits without processing
