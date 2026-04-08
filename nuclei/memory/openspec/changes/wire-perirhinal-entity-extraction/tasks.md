## 1. Types and events

- [x] 1.1 Add `perirhinal:extraction:end` event to `src/memory-events.ts` with `PerirhinalStats` payload and optional error type
- [x] 1.2 Add `perirhinal: PerirhinalStats` to `MemoryStats` in `src/memory-types.ts`
- [x] 1.3 Add optional `perirhinalProcess: EntityExtractionProcess` to `MemoryImplDeps` in `src/memory-types.ts`

## 2. MemoryImpl wiring

- [x] 2.1 Initialize `perirhinalStats: PerirhinalStats` to all-zeros in `MemoryImpl`
- [x] 2.2 In constructor, if `perirhinalProcess` is provided, subscribe to `amygdala:cycle:end` → call `perirhinalProcess.run()` fire-and-forget, emit `perirhinal:extraction:end`, update `perirhinalStats`
- [x] 2.3 Include `perirhinalStats` in `getStats()` return value

## 3. Factory wiring

- [x] 3.1 Add `@neurome/perirhinal` to `package.json` dependencies
- [x] 3.2 In `memory-factory.ts`, build the `embedEntity` adapter from `EmbeddingAdapter` using `"${entity.name} (${entity.type})"` text format
- [x] 3.3 Instantiate `EntityExtractionProcess` with `{ storage, llm: config.llmAdapter, embedEntity }`
- [x] 3.4 Pass `perirhinalProcess` to `MemoryImpl`

## 4. Tests

- [x] 4.1 Add unit test: `amygdala:cycle:end` triggers perirhinal `run()`
- [x] 4.2 Add unit test: perirhinal error sets `errors` in stats, does not throw
- [x] 4.3 Add unit test: `getStats()` returns correct `perirhinal` field
- [x] 4.4 Add unit test: `MemoryImpl` without `perirhinalProcess` constructs without error
