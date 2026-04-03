## ADDED Requirements

### Requirement: Character vocabulary construction
The embedder SHALL build a fixed character vocabulary from lowercase ASCII letters, digits, punctuation, and space. Index 0 SHALL be reserved for padding.

#### Scenario: Known character is mapped
- **WHEN** a character in the vocabulary is looked up
- **THEN** it returns a positive integer index

#### Scenario: Unknown character falls back to padding
- **WHEN** a character not in the vocabulary is encountered during tokenization
- **THEN** it is mapped to index 0

### Requirement: Text tokenization and padding
The embedder SHALL convert input text to a fixed-length integer sequence of configurable `maxSeqLen`. Sequences shorter than `maxSeqLen` SHALL be zero-padded on the right; longer sequences SHALL be truncated.

#### Scenario: Short text is padded
- **WHEN** input text has fewer characters than `maxSeqLen`
- **THEN** the resulting sequence has exactly `maxSeqLen` elements with trailing zeros

#### Scenario: Long text is truncated
- **WHEN** input text exceeds `maxSeqLen` characters
- **THEN** only the first `maxSeqLen` characters are used

### Requirement: Forward pass produces fixed-size embedding
The embedder SHALL implement: character embedding lookup → mean pooling → FC1 (ReLU) → FC2, producing a `Float32Array` of length `vectorDim`.

#### Scenario: Embedding has correct dimension
- **WHEN** `embed(text)` is called with any non-empty string
- **THEN** the returned `Float32Array` has length equal to `vectorDim`

#### Scenario: Same text produces same embedding
- **WHEN** `embed(text)` is called twice with the same input
- **THEN** both calls return identical values (deterministic given fixed weights)

### Requirement: Configurable dimensions
The embedder SHALL accept `vectorDim`, `charEmbedDim`, `hiddenDim`, and `maxSeqLen` at construction time with sensible defaults.

#### Scenario: Default construction succeeds
- **WHEN** `NeuralEmbedder` is instantiated with no arguments
- **THEN** it initializes with default dimensions and produces embeddings without error
