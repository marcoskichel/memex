## 1. Package Scaffold

- [x] 1.1 Set up `src/` directory structure: `core/`, `shell/`, `shell/clients/`
- [x] 1.2 Install `pnpm` workspace dependencies (`@neurome/ltm`, `@neurome/llm`, `neverthrow`)

## 2. Types

- [x] 2.1 Define `ExtractedEntity`, `ExtractedEdge`, `EntityResolution`, `EntityInsertPlan` types in `core/types.ts`
- [x] 2.2 Define `ExtractionError` discriminated union covering `LLM_CALL_FAILED`, `STORAGE_FAILED`, `LOCK_FAILED`
- [x] 2.3 Export all public types from `src/index.ts`

## 3. Core: resolveEntityIdentity

- [x] 3.1 Implement `resolveEntityIdentity` in `core/entity-resolver.ts`
- [x] 3.2 Unit tests: exact match, same-type merge (≥0.85), different-type at 0.82, same-type ambiguous band, no candidates

## 4. Core: buildEntityInsertPlan

- [x] 4.1 Implement `buildEntityInsertPlan` in `core/insert-plan.ts`
- [x] 4.2 Unit tests: distinct → toInsert, merge/exact → toReuse, llm-needed → llmNeeded, edges passed through

## 5. Core: extractEntitiesFromRecord

- [x] 5.1 Implement `extractEntitiesFromRecord` in `core/record-extractor.ts` — builds LLM prompt payload from `LtmRecord`
- [x] 5.2 Unit tests: record with entities metadata, record without entities, edge cases (empty data)

## 6. Shell: LLM client

- [x] 6.1 Implement `callExtractionLlm` in `shell/clients/extraction-client.ts` using `completeStructured<T>` from `@neurome/llm`
- [x] 6.2 Implement `callDeduplicationLlm` for batched LLM confirmation of ambiguous candidates
- [x] 6.3 Unit tests: mock LLM responses for merge and distinct outcomes

## 7. Shell: EntityExtractionProcess

- [x] 7.1 Implement `EntityExtractionProcess` in `shell/entity-extraction-process.ts`: acquire lock, query unlinked records, run pipeline, write results, release lock
- [x] 7.2 Implement `persistInsertPlan` — calls `insertEntity`, `insertEntityEdge`, and `insertEntityRecordLink` on `StorageAdapter`
- [x] 7.3 Export `EntityExtractionProcess` from `src/index.ts`

## 8. Integration Tests

- [x] 8.1 Integration test: full run with `InMemoryAdapter` — record with entities produces node + link, second run is idempotent
- [x] 8.2 Integration test: deduplication — two records referencing same entity produces one node and two links
- [x] 8.3 Integration test: lock contention — second process instance exits without processing
