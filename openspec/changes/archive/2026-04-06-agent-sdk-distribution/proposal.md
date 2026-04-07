# agent-sdk-distribution

## Why

Neurome has no external distribution story. All packages are `private: true`, the codebase uses the wrong vocabulary ("session" instead of the domain-correct "engram"), and there is no installable SDK for app developers. Building an agent with Neurome today requires cloning the monorepo.

This change set makes Neurome shippable: one package to install, one concept to learn, a clean programmatic API that works with the Claude Agent SDK and any MCP-compatible framework.

## What Changes

- **Rename session → engram** throughout the codebase. An engram is the neuroscience term for the physical trace a memory leaves in the brain — the precise term for an agent's isolated memory context for a task run. `sessionId` → `engramId` everywhere; `NEUROME_ENGRAM_ID` env var; aligns with the existing naming system (`cortex`, `axon`, `dendrite`, `hippocampus`, `amygdala`).
- **Drop `TransformersJsAdapter`** from `@neurome/memory`. `OpenAIEmbeddingAdapter` already exists in `@neurome/ltm`. Remove the stale Xenova default; make `embeddingAdapter` required in `MemoryConfig`.
- **Fork primitive** — add a `fork` IPC command: cortex executes `VACUUM INTO outputPath` on the active database, returning an independent snapshot the app can pass to a new engram. App manages fork file lifecycle.
- **`@neurome/sdk`** — new published package at `synapses/sdk`. Bundles cortex, axon, and dendrite. Exposes `startEngram()` and the `Engram` class. All sub-packages remain `private: true`.

## Sequencing

1. `engram-rename` — pure rename, no logic changes; land first so all downstream changes use correct names
2. `drop-xenova` — independent; can land in parallel with rename
3. `fork-protocol` — depends on engram-rename
4. `fork-command` and `fork-client` — depend on fork-protocol; can land in parallel
5. `engram-sdk` — depends on all of the above
