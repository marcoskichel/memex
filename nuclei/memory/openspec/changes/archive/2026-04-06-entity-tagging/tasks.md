## 1. Verification

- [x] 1.1 Confirm `LtmQueryOptions` is imported and passed through unmodified in `memory-types.ts` and `memory-impl.ts`
- [x] 1.2 Run `pnpm typecheck` in `nuclei/memory` after ltm types are updated — confirm `entityName` and `entityType` are available on `recall()` options without code changes

## 2. Tests

- [x] 2.1 Integration test: log insight with entity, recall with `entityName` filter, confirm result contains the record
- [x] 2.2 Integration test: recall with `entityType` filter returns only records with matching entity type
- [x] 2.3 Run `pnpm test` in `nuclei/memory` and confirm green
