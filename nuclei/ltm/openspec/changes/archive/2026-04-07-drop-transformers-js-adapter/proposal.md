## Why

`TransformersJsAdapter` is non-functional and brings a heavy `@xenova/transformers` dependency (~50MB WASM bundle) with local inference that does not work in the current runtime environment. `OpenAIEmbeddingAdapter` is the only viable bundled adapter and covers all current use cases.

## What Changes

- **BREAKING** Remove `TransformersJsAdapter` class and its source file
- **BREAKING** Remove `TransformersJsAdapter` export from the public package API
- Remove `@xenova/transformers` from `dependencies` in `package.json`
- Remove the `TransformersJsAdapter` requirement from the `ltm-embedding` spec

## Capabilities

### New Capabilities

- none

### Modified Capabilities

- `ltm-embedding`: Remove `TransformersJsAdapter` requirement; `OpenAIEmbeddingAdapter` becomes the only bundled adapter

## Impact

- Consumers importing `TransformersJsAdapter` from `@neurome/ltm` will have a broken import — they must switch to `OpenAIEmbeddingAdapter` or bring their own `EmbeddingAdapter` implementation
- Package install size decreases significantly (no WASM binary)
- No runtime behaviour changes for consumers already using `OpenAIEmbeddingAdapter`
