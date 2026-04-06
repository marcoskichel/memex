## Context

`getContext` in `handlers.ts` recalls memories purely by cosine similarity. Records from the current session or category are no more likely to surface than semantically distant ones. This violates encoding specificity — the retrieval context should match the encoding context.

## Goals / Non-Goals

**Goals:**

- Apply additive score boosts to recalled records in `mergeRecallResults` output, before final sort
- Session match: +`SESSION_MATCH_BOOST` (0.15) when `record.metadata.sessionId === payload.sessionId`
- Category match: +`CATEGORY_MATCH_BOOST` (0.10) when `record.metadata.category === payload.category`
- Cap `effectiveScore` at 1.0 after boosting
- Add optional `category?: string` to `GetContextPayload`

**Non-Goals:**

- Boosting in `recall` (raw recall endpoint — caller controls scoring)
- Persisting or indexing category on records (already stored in metadata by LTM)

## Decisions

- Boosts applied in a `applyContextBoosts()` helper after `mergeRecallResults()` returns
- Constants exported from `handlers.ts` so consumers can reason about scoring
- `record.metadata` cast to `{ sessionId?: string; category?: string }` for boost comparison
