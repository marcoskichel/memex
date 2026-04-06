## Why

Recall in `getContext` is purely content-based (cosine similarity). Tulving's encoding specificity principle — one of the most replicated findings in memory research — states that retrieval succeeds best when context at retrieval matches context at encoding. A record encoded during session A is more relevant when queried from session A than session B, even if its content is semantically similar to the query. Currently the system ignores this entirely.

## What Changes

- `getContext` SHALL boost the `effectiveScore` of recalled records that share context attributes with the current request:
  - **Session match** (`record.sessionId === payload.sessionId`): +`SESSION_MATCH_BOOST` (default: `0.15`)
  - **Category match** (`record.category === payload.category`, when category is provided): +`CATEGORY_MATCH_BOOST` (default: `0.1`)
- Boosts are additive and applied after merging the fan-out results (before final sort and cap).
- `GetContextPayload` SHALL accept an optional `category` field to enable category-match boosting.
- Both boost constants SHALL be named exports so consumers can reason about them.
- Boost values SHALL be capped such that `effectiveScore` cannot exceed `1.0`.

## Capabilities

### New Capabilities

- `context-dependent-recall`: `getContext` applies context-match boosts to recall results, prioritising records from the same session and category over semantically similar but contextually distant ones.

### Modified Capabilities

- (none — cortex has no existing specs for this)

## Impact

- `packages/cortex/src/ipc/handlers.ts` — apply session/category boosts in `getContext` after merge
- `packages/cortex/src/ipc/protocol.ts` — add optional `category` field to `GetContextPayload`
- No changes to `@memex/ltm` or `@memex/memory` required (session/category already on records)
