# Tasks: drop-xenova

- [x] Remove `TransformersJsAdapter` import and default from `nuclei/memory/src/memory-factory.ts`
- [x] Make `embeddingAdapter` a required field in `MemoryConfig` (no `?`, no fallback)
- [x] Remove `TransformersJsAdapter` mock from `memory.test.ts`
- [x] Verify `OpenAIEmbeddingAdapter` is correctly exported from `@neurome/ltm`
- [x] Clean stale dist artifacts from `nuclei/ltm/dist/adapters/`
