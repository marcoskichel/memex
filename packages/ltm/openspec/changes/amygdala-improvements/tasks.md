## 1. Type Changes

- [ ] 1.1 Add `tags?: string[]` to `LtmQueryOptions` in `ltm-engine-types.ts`

## 2. Filter Logic

- [ ] 2.1 In `filterCandidates` (`core/query-filters.ts`), add a tags filter block: when `options.tags` is present and non-empty, exclude records where `record.metadata.tags` is not an array or does not include every specified tag

## 3. Tests

- [ ] 3.1 Unit test: query with `tags: ['behavioral']` → only records with that tag returned
- [ ] 3.2 Unit test: query with `tags: ['behavioral', 'preference']` → only records containing BOTH tags returned; record with only one tag excluded
- [ ] 3.3 Unit test: query with `tags: []` → all records returned (no filter applied)
- [ ] 3.4 Unit test: query without `tags` → all records returned (existing behaviour unchanged)
- [ ] 3.5 Unit test: record with missing `metadata.tags` excluded when tags filter is specified
- [ ] 3.6 Unit test: record with `metadata.tags` as non-array string excluded when tags filter is specified
- [ ] 3.7 Unit test: `tags` combined with `tier` filter → record must satisfy both
