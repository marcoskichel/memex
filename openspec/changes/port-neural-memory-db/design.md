## Context

The source project is a single Python file (`ai_db_engine.py`) that combines a PyTorch character-level neural network, an in-memory record store, and a FastAPI HTTP layer. The goal is to extract the core data-structure logic into a pure TypeScript library package (`packages/engram`) within the neurokit Turborepo, with no HTTP layer and no ML framework dependency.

## Goals / Non-Goals

**Goals:**
- Faithful port of the embedding model (character-level feed-forward, mean pooling, two linear layers with ReLU)
- Preserve all CRUD operations: insert, bulk-insert, update, delete
- Preserve cosine-similarity query with heuristic NL filters (amount threshold, "last week")
- Fully typed public API surface
- Unit-tested with Vitest

**Non-Goals:**
- HTTP / REST layer (the original FastAPI app) — callers integrate directly via the package API
- Persistent storage — in-memory only for now
- Pre-trained weights — random weights (same as the prototype)
- GPU acceleration or WASM — pure JS number arrays

## Decisions

**No ML framework dependency**

Alternatives: `onnxruntime-node`, `@tensorflow/tfjs-node`, hand-rolled math.

Decision: hand-rolled float32 array math. The network is tiny (embedding → mean-pool → fc1 → relu → fc2); a full ML runtime would be a massive dependency for 3 matrix multiplications. Pure arrays keep the package zero-dependency and bundle-friendly.

**Typed float arrays via `Float32Array`**

Alternatives: `number[]`, `tf.Tensor`.

Decision: `Float32Array` gives typed fixed-width storage and aligns with eventual WASM/SIMD upgrades without changing the API.

**Single exported class `EngramEngine` + factory `createEngramEngine()`**

Alternatives: functional module exports, multiple classes.

Decision: a single class mirrors the Python `AssociativeMemoryEngine`, keeps state encapsulated, and is easy to mock in tests. A factory function is exported for ergonomics.

**No HTTP layer**

The Python prototype mixed HTTP concern into the engine file. We separate them: `packages/engram` is a library. If an HTTP API is needed later, it becomes a separate app consuming the package.

**Heuristic filter extraction stays simple regex**

The original uses two regex heuristics (amount `above $N`, time `last week`). We keep these verbatim, clearly documented as extensible. No NLP library needed.

## Risks / Trade-offs

[Random weights] → Embeddings are semantically meaningless without trained weights. Similarity search will match character-pattern similarity only. Mitigation: document clearly; weight loading is a future extension point.

[In-memory only] → Data is lost on process restart. Mitigation: non-goal; document in README; persistence is a future extension.

[Pure-JS matrix math] → No SIMD; large corpora will be slow. Mitigation: out of scope for this port; the original prototype had the same limitation.
