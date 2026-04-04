## Why

Two gaps in amygdala's write path cause silent data loss. First, the hippocampus `minClusterSize = 3` gate means any episodic with fewer than 3 near-neighbors decays and is hard-deleted with no semantic promotion path, even if its importance score is high — a single critical fact stated once (e.g. "user has a nut allergy") will be lost. Second, `InsightEntry.tags` are consumed for internal amygdala filtering but are never forwarded to LTM, silently dropping agent-supplied tags.

## What Changes

- `AmygdalaConfig` gains `singletonPromotionThreshold?: number` (default `0.7`)
- In `applyAction`, when action is `insert`, `importanceScore >= singletonPromotionThreshold`, and no related memories were found (empty relatedness list), the LTM insert uses `tier: 'semantic'`
- At every LTM insert, `entry.tags` minus internal tags (`permanently_skipped`, `llm_rate_limited`) are written to `metadata.tags`

## Capabilities

### New Capabilities

- `amygdala-singleton-promotion`: high-importance singletons bypass hippocampus and are stored as semantic memories
- `amygdala-tag-forwarding`: agent-supplied tags reach LTM records

### Modified Capabilities

- `amygdala-scoring`: `applyAction` extended with singleton promotion branch and tag forwarding

## Impact

- `packages/amygdala`: `amygdala-schema.ts` (config type, new constant), `amygdala-process.ts` (`applyAction`)
- **Depends on `ltm-schema-extensions` being merged first** — requires `tier?` on `LtmInsertOptions`
