# recall-min-results

## What

Add `minResults` to `LtmQueryOptions` and wire a sensible default in `memory.recall()` so that open queries always surface at least a small number of records rather than returning empty.

## Why

The current query threshold (0.5) is applied to `effectiveScore = cosine_similarity × retention`. For open or broad queries, cosine similarity is naturally diffuse (0.4–0.6) and when multiplied by any retention decay the combined score falls below the threshold — producing empty results. The LLM calling `recall` is a better judge of relevance than a fixed numeric gate; it is preferable to surface something weakly related than nothing at all.

## Scopes

- `packages/ltm` — add `minResults` to `LtmQueryOptions`; implement top-up pass in query execution
- `packages/memory` — wire a default `minResults` of `1` in `recall()` so open queries always return something

## Sequencing

`ltm` first (type + logic), `memory` second (default wiring). Independent enough to do in one pass.
