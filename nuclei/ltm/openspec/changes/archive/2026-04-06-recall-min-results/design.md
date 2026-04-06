## Context

`collectQueryResults` in `engine-ops.ts` iterates `rrfScores`, computes `effectiveScore = sim × retention`, and skips records below `threshold`. The top-up pass runs after this function completes, using the same candidate set that was already scored.

## Goals / Non-Goals

**Goals:**

- Guarantee `minResults` records are returned when candidates exist with non-trivial similarity
- Preserve existing threshold behaviour for all records that pass it
- Keep top-up records clearly separated from threshold-passing records in rank order

**Non-Goals:**

- Changing the threshold default
- Changing how `effectiveScore` is computed
- Returning records with near-zero cosine similarity (gibberish prevention)

## Decisions

**Top-up floor: cosine similarity > 0.05**
Without any floor, cosine similarity between unrelated embeddings is still positive (typically 0.05–0.15 for truly random text). A floor of 0.05 excludes the bottom tail while allowing weakly related records through. This floor applies only during top-up, not during normal threshold filtering.

**Top-up appended after threshold-passing results**
Results are ordered: threshold-passing records first (ranked by effectiveScore), then top-up records (ranked by effectiveScore). Callers can observe which records came from top-up via lower effectiveScore values.

**`minResults` in QueryContext, not post-processing**
Pass `minResults` into `executeQuery` so the top-up logic lives alongside the threshold logic in `engine-ops.ts`, not scattered across callers.

**No strengthening of top-up records**
`strengthenResults` only runs on threshold-passing records. Top-up records are not strengthened — they were weak matches and should not have their stability boosted.

## Risks / Trade-offs

**[Risk]** Top-up records are below the quality bar the caller set → Mitigation: they rank lower than threshold-passing records; the LLM caller discards what is not useful. This is the explicit design intent.

**[Risk]** `minResults > limit` creates ambiguity → Mitigation: `minResults` is applied before `limit`; the final result is `results.slice(0, limit)` as before.
