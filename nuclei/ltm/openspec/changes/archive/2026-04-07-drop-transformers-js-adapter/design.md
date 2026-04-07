## Context

`TransformersJsAdapter` was introduced as the default, zero-config embedding adapter using local WASM inference via `@xenova/transformers`. It has never worked reliably in this runtime and the `@xenova/transformers` package is a large, complex dependency (~50MB) that adds significant install overhead. `OpenAIEmbeddingAdapter` already covers production embedding needs.

## Goals / Non-Goals

**Goals:**

- Remove `TransformersJsAdapter` and its source file entirely
- Remove `@xenova/transformers` from `package.json` dependencies
- Update the public API (index.ts) and the `ltm-embedding` spec to reflect the removal

**Non-Goals:**

- Replacing `TransformersJsAdapter` with another local-inference adapter
- Adding any new adapter
- Changing `OpenAIEmbeddingAdapter` or the `EmbeddingAdapter` interface

## Decisions

**Delete rather than deprecate.** The adapter does not work at all; leaving it with a deprecation warning would encourage consumers to try it and hit the same failure. Hard removal forces the consumer to pick a working adapter immediately.

**Keep `EmbeddingAdapter` interface unchanged.** Consumers who built their own adapter implementations are not impacted.

## Risks / Trade-offs

- [Breaking change for direct consumers of `TransformersJsAdapter`] → Clearly documented in proposal; no known consumers outside this monorepo
