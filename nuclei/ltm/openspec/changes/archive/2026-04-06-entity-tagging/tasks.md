## 1. Dependencies

- [x] 1.1 Add `@neurome/cortex-ipc` as a dependency in `nuclei/ltm/package.json`

## 2. Type Changes

- [x] 2.1 Import `EntityMention`, `EntityType` from `@neurome/cortex-ipc` in `ltm-engine-types.ts`
- [x] 2.2 Add `entities?: EntityMention[]` to `LtmRecord.metadata` type (or document convention)
- [x] 2.3 Add `entityName?: string` and `entityType?: EntityType` to `LtmQueryOptions`

## 3. Query Filter Implementation

- [x] 3.1 Add `entityName` and `entityType` to the candidate pre-filter in `query-filters.ts`
- [x] 3.2 `entityName` filter uses case-insensitive substring match against entity `name`
- [x] 3.3 `entityType` filter uses exact match against entity `type`
- [x] 3.4 Both filters AND-combined with existing filters

## 4. Tests

- [x] 4.1 Unit test: insert record with `metadata.entities`, retrieve and confirm persisted
- [x] 4.2 Unit test: `entityName` filter returns only matching records
- [x] 4.3 Unit test: `entityType` filter returns only matching records
- [x] 4.4 Unit test: combined `entityName` + `entityType` filter
- [x] 4.5 Unit test: records without `metadata.entities` excluded when entity filter active
- [x] 4.6 Run `pnpm test` in `nuclei/ltm` and confirm green
