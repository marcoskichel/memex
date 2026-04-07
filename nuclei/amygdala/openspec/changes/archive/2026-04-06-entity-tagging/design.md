## Context

The amygdala's `amygdalaScoringSchema` uses `completeStructured<AmygdalaScoringResult>` — a typed LLM call that returns a validated JSON object. The LLM already has the full observation text in context. Entity extraction is a natural addition to the same structured output.

## Goals / Non-Goals

**Goals:**

- Extract entity mentions in the same LLM call that scores the observation
- Store entities on `AmygdalaScoringResult` so the amygdala process can pass them to the LTM insert

**Non-Goals:**

- Entity deduplication or merging
- A separate LLM call for entity extraction
- Storing entities in a dedicated SQLite table (Phase 2)

## Decisions

**Bundle into the existing schema call, not a second LLM call.** The structured output schema can include an `entities` array alongside `action`, `importanceScore`, etc. One call, one latency hit, one cost entry.

**`entities` is always present, never undefined.** Default to `[]` if the LLM returns nothing. The `parse` function in `amygdalaScoringSchema` must handle missing/invalid `entities` gracefully and default to `[]` — consistent with how `targetId` and `edgeType` are handled today.

**Prompt instructs negative examples.** The system prompt must tell the LLM what NOT to extract: bare pronouns, abstract nouns ("the system", "this"), temporal expressions, and generic verbs. Without this, entity precision drops significantly.

**Entity types sourced from `@neurome/cortex-ipc`.** This avoids duplicating the `EntityType` union in amygdala. Amygdala adds `cortex-ipc` as a dependency (it's already a sibling package in the monorepo).

## Risks / Trade-offs

- LLM entity extraction quality depends on prompt engineering. First version may over-extract generic nouns. Mitigated by strong negative examples in the system prompt and the fact that entities are metadata — false positives don't corrupt the memory record itself.
- `entities: []` on skip-classified records is harmless; amygdala already discards those entries before LTM insert.
