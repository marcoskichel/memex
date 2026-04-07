# drop-xenova

## Why

`memory-factory.ts` still imports `TransformersJsAdapter` from `@neurome/ltm` as the default embedding adapter, but `TransformersJsAdapter` no longer exists in `@neurome/ltm`. `OpenAIEmbeddingAdapter` is already implemented and exported. The stale default needs to be removed and `embeddingAdapter` made a required field so callers explicitly choose their adapter.

## What Changes

- Remove `TransformersJsAdapter` import and default from `nuclei/memory/src/memory-factory.ts`
- Make `embeddingAdapter` a required field in `MemoryConfig` (remove the `?` and the fallback)
- Remove the `TransformersJsAdapter` mock from `memory.test.ts`
- Ensure `OpenAIEmbeddingAdapter` is correctly exported from `@neurome/ltm` (already the case)

## Impact

- **BREAKING** — callers of `createMemory()` must now pass an explicit `embeddingAdapter`
- Recommended default: `new OpenAIEmbeddingAdapter({ apiKey: process.env.OPENAI_API_KEY })`
- No changes to the `EmbeddingAdapter` interface or `LtmEngine`
