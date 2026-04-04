## 1. Config and Options

- [ ] 1.1 Add `category?: string` to `HippocampusConfig` in `hippocampus-schema.ts`

## 2. Consolidation

- [ ] 2.1 In `hippocampus-process.ts` consolidation pass, pass `category: config.category` to `ltm.consolidate()` when set

## 3. Context File Deletion

- [ ] 3.1 Remove the LTM cross-reference query from the context file deletion logic
- [ ] 3.2 Delete all context files with `safeToDelete === true` unconditionally after prune

## 4. Tests

- [ ] 4.1 Unit test: consolidated record has `category` matching `HippocampusConfig.category`
- [ ] 4.2 Unit test: consolidated record has no `category` when config omits it
- [ ] 4.3 Unit test: `safeToDelete = true` files are deleted without LTM query
- [ ] 4.4 Unit test: `safeToDelete = false` files are not deleted
