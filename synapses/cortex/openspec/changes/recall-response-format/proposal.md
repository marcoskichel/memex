## Why

The MCP recall tool returns raw internal storage records to LLMs, leaking implementation details (hash tags, embedding metadata, dual-purpose score fields, duplicate fields) that waste context tokens and make supersession relationships invisible. The current format requires the LLM to infer relationships between superseded records and their companions with no explicit linkage.

## What Changes

- Strip internal-only fields from recall responses: `rrfScore`, `embeddingMeta`, `accessCount`, `tombstoned`, `stability`, hash-format tags
- Remove duplicate `episodeSummary` field (redundant with `data` for episodic records)
- Replace raw `effectiveScore` float with bucketed `relevance: "high" | "medium" | "low"`
- Group superseded records with their companion (superseding) records into a single `MemoryChange` unit
- Expose `retrievedAs: "companion"` as a top-level signal when a record was injected
- Rename `data` → `memory` for semantic clarity in LLM context

## Capabilities

### New Capabilities

- `recall-response-format`: LLM-optimized serialization of recall results, including grouped change units for superseded/companion record pairs

### Modified Capabilities

<!-- none — context-retrieval uses recall internally but its spec-level behavior (sort by relevance, deduplicate, cap) is unchanged -->

## Impact

- `synapses/cortex/src/ipc/handlers.ts` — recall serialization logic
- `nuclei/cortex-ipc/src/protocol.ts` — response type definitions
- Any MCP client consuming recall results (LLM agents, SDK) — **BREAKING** format change
