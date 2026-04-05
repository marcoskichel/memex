## 1. Config and Options

- [x] 1.1 Add `category?: string` to `HippocampusConfig` in `hippocampus-schema.ts`

## 2. Consolidation

- [x] 2.1 In `hippocampus-process.ts` consolidation pass, pass `category: config.category` to `ltm.consolidate()` when set

## 3. Context File Deletion

- [x] 3.1 Remove the LTM cross-reference query from the context file deletion logic
- [x] 3.2 Delete all context files with `safeToDelete === true` unconditionally after prune

## 4. Tests

- [x] 4.1 Unit test: consolidated record has `category` matching `HippocampusConfig.category`
- [x] 4.2 Unit test: consolidated record has no `category` when config omits it
- [x] 4.3 Unit test: `safeToDelete = true` files are deleted without LTM query
- [x] 4.4 Unit test: `safeToDelete = false` files are not deleted
