## 1. Package Scaffold

- [ ] 1.1 Create `packages/engram/` directory with `package.json` (`@neurokit/engram`, no runtime deps, `main`/`types` pointing to `dist/`)
- [ ] 1.2 Add `tsconfig.json` extending the repo base config
- [ ] 1.3 Add `vitest.config.ts` for unit tests
- [ ] 1.4 Register `@neurokit/engram` in `pnpm-workspace.yaml` (already covered by `packages/*` glob — verify)

## 2. Neural Embedder

- [ ] 2.1 Implement `src/neural-embedder.ts`: build character vocabulary (lowercase + digits + punctuation + space, index 0 = padding)
- [ ] 2.2 Implement tokenization: text → `number[]` of length `maxSeqLen` with zero-padding and truncation
- [ ] 2.3 Implement weight initialization: random `Float32Array` matrices for embedding, FC1, FC2
- [ ] 2.4 Implement forward pass: embedding lookup → mean pool → FC1 + ReLU → FC2 → `Float32Array`
- [ ] 2.5 Write unit tests for `NeuralEmbedder`: vocabulary mapping, padding, truncation, output dimension, determinism

## 3. Cosine Similarity Utility

- [ ] 3.1 Implement `src/cosine-similarity.ts`: `cosineSimilarity(a: Float32Array, b: Float32Array): number`
- [ ] 3.2 Write unit tests: identical vectors → 1.0, orthogonal vectors → 0.0, zero vector edge case

## 4. Heuristic Filter Extraction

- [ ] 4.1 Implement `src/extract-filters.ts`: parse "above $N" → `amountThreshold`, "last week" → `timeRange` (past 7 days UTC)
- [ ] 4.2 Write unit tests: amount match, time match, no match, both matches, case insensitivity

## 5. Associative Memory Engine

- [ ] 5.1 Implement `src/engram-engine.ts` class `EngramEngine` with in-memory `Map<number, MemoryRecord>`
- [ ] 5.2 Implement `insert(data, metadata)` → assigns ID, computes embedding, stores record, returns ID
- [ ] 5.3 Implement `bulkInsert(records[])` → calls insert per record, returns ID array
- [ ] 5.4 Implement `update(id, { data?, metadata? })` → recomputes embedding if `data` changes, merges metadata, returns boolean
- [ ] 5.5 Implement `delete(id)` → removes from map, returns boolean
- [ ] 5.6 Implement `query(nlQuery, threshold)` → embed query, compute similarity for all records, apply filters, sort desc
- [ ] 5.7 Write unit tests for all CRUD operations and query filtering (amount + time filters)

## 6. Public API Surface

- [ ] 6.1 Create `src/index.ts` exporting `EngramEngine`, `createEngramEngine`, `EngramRecord`, `EngramOptions`
- [ ] 6.2 Implement `createEngramEngine(options?)` factory with all defaults applied
- [ ] 6.3 Write a smoke test importing from the package entry point and verifying insert + query round-trip

## 7. Build & CI Wiring

- [ ] 7.1 Add `build` script to `packages/engram/package.json` using `tsc`
- [ ] 7.2 Verify `turbo build` includes the new package
- [ ] 7.3 Run full test suite (`pnpm vitest run`) and fix any failures
