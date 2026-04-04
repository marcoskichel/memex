## Context

The amygdala's `applyAction` function currently writes `{ source: 'amygdala', insightId: entry.id }` to `LtmRecord.metadata` and marks context files `safeToDelete` only after hippocampus has processed them. With the new LTM schema fields available, the write path should populate `sessionId` (from config) and `episodeSummary` (from `InsightEntry.text`) directly, and the `safeToDelete` mark should move to immediately after the LTM write — eliminating the hippocampus cross-reference dependency.

## Goals / Non-Goals

**Goals:**

- Populate `sessionId` on every amygdala-inserted record
- Populate `episodeSummary` with `InsightEntry.text` on every insert
- Mark context file `safeToDelete = true` immediately after LTM write succeeds

**Non-Goals:**

- Setting `category` — that remains caller responsibility
- Changing amygdala scoring logic or retry behaviour

## Decisions

### `safeToDelete` timing moved to immediately after LTM write

Previously: hippocampus was responsible for marking files safe to delete after consolidation.
Now: amygdala marks `safeToDelete = true` as soon as `episodeSummary` is written to the LTM record, because the context file is no longer needed — its content is preserved inline.

This simplifies hippocampus: it can delete all `safeToDelete = true` files unconditionally without querying LTM to check for active references.

### `sessionId` sourced from `AmygdalaConfig`, not from `InsightEntry`

`InsightEntry` does not carry a `sessionId` (it's session-scoped implicitly by the `InsightLog` it lives in). The amygdala process is created per-session by the `Memory` orchestrator, so `sessionId` belongs in `AmygdalaConfig` as a required field set at construction time.

## Risks / Trade-offs

- **`sessionId` required on `AmygdalaConfig`** → breaking change to `AmygdalaConfig` type; callers constructing amygdala directly must pass `sessionId` → `Memory` factory already manages this; direct callers are rare
