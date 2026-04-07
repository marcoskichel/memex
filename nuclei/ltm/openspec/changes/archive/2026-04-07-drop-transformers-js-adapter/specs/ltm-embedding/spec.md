## REMOVED Requirements

### Requirement: TransformersJsAdapter is the default adapter

**Reason**: The adapter is non-functional in the current runtime environment and brings a large, complex WASM dependency (`@xenova/transformers`) with no benefit.
**Migration**: Use `OpenAIEmbeddingAdapter` with an `apiKey`, or implement the `EmbeddingAdapter` interface directly.
