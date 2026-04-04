## Context

Two focused changes to hippocampus. First: the LLM consolidation prompt produces a semantic record via `ltm.consolidate()`; that call should be able to forward a `category` if the caller supplies one via `HippocampusConfig` or consolidation options. Second: hippocampus currently cross-references LTM records to check for active context file references before deletion. Since amygdala now marks files `safeToDelete` immediately after writing `episodeSummary`, that cross-reference is unnecessary — hippocampus can delete unconditionally.

## Goals / Non-Goals

**Goals:**

- Forward `category` from hippocampus config/options to `ltm.consolidate()`
- Remove the LTM cross-reference from context file deletion; delete all `safeToDelete = true` files directly

**Non-Goals:**

- Hippocampus does not infer or set `category` autonomously — it only forwards what is configured

## Decisions

### Category is config-level, not per-cluster

Hippocampus does not have enough context to assign different categories to different clusters automatically. Category is a single optional value in `HippocampusConfig` applied to all consolidated records produced by that hippocampus instance. Callers that need per-category consolidation run separate hippocampus instances.

### Deletion becomes unconditional on safeToDelete flag

Old: hippocampus queried LTM for records referencing a context file path before deleting.
New: amygdala owns the `safeToDelete` flag and sets it only after `episodeSummary` is written. Hippocampus trusts the flag — if it's set, the file is safe to delete.

## Risks / Trade-offs

- **`category` applied to all clusters uniformly** → for mixed-content consolidation, callers may need multiple hippocampus instances; acceptable at agent scale where a single hippocampus instance already handles one agent's memories
