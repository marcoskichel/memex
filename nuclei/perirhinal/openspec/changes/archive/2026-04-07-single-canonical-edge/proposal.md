## Why

`persistInsertPlan` calls `insertEntityEdge` for every edge the LLM extracts from a record. Because two different records can produce the same relationship (e.g. `Maya → Atlas [leads]`), the pipeline could accumulate duplicate edges in the graph. With the storage layer enforcing `(fromId, toId, type)` uniqueness, this becomes a no-op — but the spec should document that edge writes are idempotent so callers and future implementers understand the contract.

## What Changes

- Update `entity-extraction-process` spec to document that edge writes via `persistInsertPlan` are idempotent by `(fromName, toName, relationshipType)` — no duplicate edge will be created if the same triple is written more than once

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `entity-extraction-process`: `persistInsertPlan` edge write semantics — duplicate `(fromName, toName, relationshipType)` triples within or across runs SHALL produce a single edge in the graph

## Impact

- `persistInsertPlan`: no code change needed — idempotency is guaranteed by the storage layer
- `entity-extraction-process` spec: add idempotency scenario to `buildEntityInsertPlan` / `persistInsertPlan` requirements
