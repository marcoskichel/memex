## Context

`applyAction` currently always calls `ltm.insert()` with `tier: 'episodic'` (the implicit default). The hippocampus `findConsolidationCandidates` uses `minClusterSize = 3`, so any record without at least 2 near-neighbors is never consolidated and eventually pruned by hard-delete. High-importance singletons have no escape path. Additionally, `entry.tags` are filtered for internal amygdala tags (`permanently_skipped`, `llm_rate_limited`) in `selectBatch` but are never written anywhere useful — they are lost after `markProcessed`.

## Goals / Non-Goals

**Goals:**

- Promote high-importance singleton inserts directly to semantic tier
- Forward agent-supplied tags (minus internal tags) to `LtmRecord.metadata.tags` on every insert
- Keep the promotion threshold configurable per `AmygdalaConfig`

**Non-Goals:**

- Changing hippocampus consolidation logic
- Promoting entries that have existing related memories (they will consolidate normally)
- Forwarding tags on `relate` calls (tags go on the newly inserted record, which is always present for relate actions too — see Decision below)

## Decisions

### Singleton promotion fires only on the `insert` branch when related memories list is empty

`fetchRelatedMemories` is called before `applyAction`. If it returns a non-empty list, the LLM may still score `action: 'insert'` (new independent memory, just not relating to any specific existing one) or `action: 'relate'`. The promotion condition requires BOTH `action === 'insert'` AND the related memories list being empty, meaning the amygdala had no LTM candidates to show the LLM. This is the strongest signal that the entry is a genuine singleton with no semantic neighborhood to consolidate into.

Passing the relatedness list into `applyAction` is the cleanest approach — it is already computed in `processEntry` before the scoring call and avoids a second LTM round-trip.

### Internal tag exclusion list is a module-level constant

Tags `permanently_skipped` and `llm_rate_limited` are internal amygdala bookkeeping tags that have no semantic meaning to agents or LTM consumers. They are excluded by a module-level `INTERNAL_TAGS` constant to make the exclusion rule explicit and testable.

### Tags forwarded on both `insert` and `relate` actions

When action is `relate`, amygdala still calls `ltm.insert()` first (the new record) then `ltm.relate()`. The new record should carry the agent-supplied tags. There is no reason to omit them on relate paths.

### `singletonPromotionThreshold` defaults to `0.7`

The system prompt already instructs the LLM to "reserve 0.7+ for genuinely significant information." Using the same boundary as the semantic threshold in the prompt ensures consistent semantics between the LLM's scoring rubric and the promotion gate.

## Risks / Trade-offs

- **Relatedness list passed through `processEntry` → `applyAction`**: minor coupling increase, but avoids a second LTM query and keeps `applyAction` pure (no LTM reads, only writes).
- **Semantic tier bypasses hippocampus**: intentional. Semantic records are meant to be stable facts. The hippocampus consolidation pipeline is for episodic-to-semantic promotion, not for records that are already semantic.
