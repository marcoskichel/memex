## Context

`persistInsertPlan` calls `storage.insertEntityEdge` for every edge in `plan.edgesToInsert`. These edges come from the LLM extraction call, which is non-deterministic across records. Two different records may both produce `Maya → Atlas [leads]`, resulting in duplicate edges if no uniqueness constraint is enforced.

The storage layer (ltm scope) is adding a `UNIQUE(from_id, to_id, type)` index and switching to `INSERT OR IGNORE`. This change in the perirhinal scope only needs to document that the behavior is now defined and intentional.

## Goals / Non-Goals

**Goals:**

- Document that edge writes in `persistInsertPlan` are idempotent across runs
- Ensure the `entity-extraction-process` spec reflects the correct semantics

**Non-Goals:**

- Any code change in perirhinal — the guarantee comes from the storage layer
- Deduplicating edges before calling `insertEntityEdge` in `persistInsertPlan`

## Decisions

**No code change in perirhinal.**
The idempotency is enforced by the storage layer. Adding a pre-insert dedup check in `persistInsertPlan` would be redundant and would couple the process layer to storage semantics it shouldn't need to know about.

**Spec-only change.**
Add an idempotency scenario to the `entity-extraction-process` spec under `persistInsertPlan` requirements.

## Risks / Trade-offs

[Spec lags implementation] → The storage layer change lands independently. Until this spec delta is merged, the spec is technically incomplete. Low risk — no consumer relies on the spec for edge deduplication behavior today.
