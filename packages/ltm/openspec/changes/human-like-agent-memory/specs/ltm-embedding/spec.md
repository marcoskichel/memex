## ADDED Requirements

### Requirement: EmbeddingAdapter interface

The LTM package SHALL define an `EmbeddingAdapter` interface with `readonly modelId: string`, `readonly dimensions: number`, and `embed(text: string): ResultAsync<EmbedResult, EmbedError>`. All embedding operations in the system SHALL go through this interface.

#### Scenario: embed returns EmbedResult on success

- **WHEN** `adapter.embed('some text')` is called
- **THEN** a `ResultAsync` resolving to `{ vector: Float32Array, modelId: string, dimensions: number }` is returned

#### Scenario: embed returns EmbedError on failure

- **WHEN** the underlying model is unavailable
- **THEN** a `ResultAsync` resolving to an `EmbedError` with type `EMBED_API_UNAVAILABLE` is returned

#### Scenario: embed rejects empty input

- **WHEN** `adapter.embed('')` is called
- **THEN** a `ResultAsync` resolving to `{ type: 'EMBED_EMPTY_INPUT' }` is returned

### Requirement: TransformersJsAdapter is the default adapter

The package SHALL provide a `TransformersJsAdapter` using `Xenova/all-MiniLM-L6-v2` (384 dimensions) via `@xenova/transformers` with local WASM inference. No API key SHALL be required. The pipeline SHALL initialize lazily on the first `embed()` call.

#### Scenario: Default adapter works without API key

- **WHEN** `new TransformersJsAdapter()` is created with no arguments
- **THEN** `embed('hello')` succeeds without any API key configured

#### Scenario: Cold start completes within 5 seconds

- **WHEN** `embed()` is called for the first time on a fresh adapter
- **THEN** the pipeline initializes and the call completes within 5 seconds

#### Scenario: Subsequent calls are sub-100ms

- **WHEN** `embed()` is called after the pipeline is initialized
- **THEN** the call completes in under 100ms

### Requirement: OpenAIEmbeddingAdapter as an alternative

The package SHALL provide an `OpenAIEmbeddingAdapter` using `text-embedding-3-small` (1536 dimensions). It SHALL require an `apiKey` at construction. It SHALL fail with `EMBED_API_UNAVAILABLE` on network error and SHALL NOT silently fall back to another model.

#### Scenario: OpenAIEmbeddingAdapter requires apiKey

- **WHEN** `new OpenAIEmbeddingAdapter({ apiKey: '' })` is called with an empty key
- **THEN** the adapter is constructed but the first `embed()` call fails with `EMBED_API_UNAVAILABLE`

#### Scenario: Network failure returns EMBED_API_UNAVAILABLE

- **WHEN** the OpenAI API is unreachable
- **THEN** `embed()` returns `{ type: 'EMBED_API_UNAVAILABLE', cause: <error> }` without retrying

### Requirement: Dimension mismatch error

If `embed()` is called and the returned vector dimensions do not match `adapter.dimensions`, the adapter SHALL return `{ type: 'EMBED_DIMENSION_MISMATCH', expected: number, actual: number }`.

#### Scenario: Dimension mismatch is surfaced

- **WHEN** the underlying model returns a vector of unexpected size
- **THEN** `embed()` returns `EMBED_DIMENSION_MISMATCH` rather than a partial result

### Requirement: reembedAll migration utility

The package SHALL provide `reembedAll(adapter: EmbeddingAdapter, storage: StorageAdapter): ResultAsync<{ reembedded: number }, ReembedError>`. It SHALL re-embed every stored record with the provided adapter and call `storage.updateEmbedding()` for each. It SHALL NEVER run automatically on startup. It is a consumer-driven explicit migration.

#### Scenario: reembedAll updates all records

- **WHEN** `reembedAll(newAdapter, storage)` is called
- **THEN** every record in storage has its embedding and embeddingMeta updated to the new adapter's output

#### Scenario: reembedAll fails fast on storage error

- **WHEN** `storage.updateEmbedding()` throws for any record
- **THEN** `reembedAll` returns `{ type: 'REEMBED_STORAGE_FAILED', cause: <error> }` and stops processing

#### Scenario: reembedAll is never called automatically

- **WHEN** `createLtmEngine()` is called with a new adapter whose modelId differs from stored records
- **THEN** no automatic re-embedding occurs; the mismatch is only surfaced on the first `query()` call
