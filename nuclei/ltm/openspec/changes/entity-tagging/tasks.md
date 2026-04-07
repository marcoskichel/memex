## 1. Dependencies

- [ ] 1.1 Add `@neurome/cortex-ipc` as a dependency in `nuclei/ltm/package.json`

## 2. Type Changes

- [ ] 2.1 Import `EntityMention`, `EntityType` from `@neurome/cortex-ipc` in `ltm-engine-types.ts`
- [ ] 2.2 Add `entities?: EntityMention[]` to `LtmRecord.metadata` type (or document convention)
- [ ] 2.3 Add `entityName?: string` and `entityType?: EntityType` to `LtmQueryOptions`

## 3. Query Filter Implementation

- [ ] 3.1 Add `entityName` and `entityType` to the candidate pre-filter SQL in `query-helpers.ts` using `json_each(metadata, '$.entities')`
- [ ] 3.2 `entityName` filter uses case-insensitive `LIKE` match against entity `name`
- [ ] 3.3 `entityType` filter uses exact match against entity `type`
- [ ] 3.4 Both filters AND-combined with existing `sessionId` / `category` filters

## 4. Tests

- [ ] 4.1 Unit test: insert record with `metadata.entities`, retrieve and confirm persisted
- [ ] 4.2 Unit test: `entityName` filter returns only matching records
- [ ] 4.3 Unit test: `entityType` filter returns only matching records
- [ ] 4.4 Unit test: combined `entityName` + `entityType` filter
- [ ] 4.5 Unit test: records without `metadata.entities` excluded when entity filter active
- [ ] 4.6 Run `pnpm test` in `nuclei/ltm` and confirm green
