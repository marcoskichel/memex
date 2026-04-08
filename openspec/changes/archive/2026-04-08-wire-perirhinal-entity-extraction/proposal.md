# wire-perirhinal-entity-extraction

## What

Wire `EntityExtractionProcess` (from `@neurome/perirhinal`) into the memory pipeline so entity nodes and edges are automatically extracted and persisted after each amygdala cycle, mirroring how the human perirhinal cortex processes stimuli co-actively with the hippocampus.

## Why

`EntityExtractionProcess` is fully built and tested in isolation but never started anywhere in the running system. As a result, the entity graph (`entities`, `entity_edges`, `entity_record_links` tables) is always empty in production. No entity paths can be found, no graph-aware recall is possible, and `getUnlinkedRecordIds()` accumulates indefinitely.

The amygdala inserts LTM records with `metadata.entities` (name + type pairs extracted by LLM). Perirhinal is designed to read exactly those unlinked records, embed entities, deduplicate via cosine similarity + LLM, and persist `EntityNode` entries with edges. The machinery is complete — it just isn't wired.

## Brain model

In the human brain, the perirhinal cortex fires **during encoding**, not in a deferred batch. It sits anatomically adjacent to the hippocampus and processes entity recognition co-actively as memories are formed. The closest analog in this system is triggering perirhinal immediately after each amygdala cycle via the existing `amygdala:cycle:end` event — not on a separate timer.

## Scopes

- **memory** — instantiate `EntityExtractionProcess` in `createMemory`, subscribe to `amygdala:cycle:end` to trigger `run()`, expose perirhinal stats in `MemoryStats`
- **perirhinal** — expose a `PerirhinalProcess` type (schedulable interface) and stats shape for consumption by `memory`; ensure `index.ts` exports everything needed
- **cortex** — surface perirhinal stats via memory events and IPC so the cortex process can observe entity extraction activity

## Shared contracts

- `PerirhinalStats` shape (defined in perirhinal, consumed by memory + cortex)
- `perirhinal:extraction:end` event (emitted by memory, broadcast by cortex)
- Embed function adapter: `(entity: ExtractedEntity) => Promise<Float32Array>` built from `EmbeddingAdapter` using `\`${entity.name} (${entity.type})\`` as the text
