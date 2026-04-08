## Context

Two separate problems compound each other:

1. The extraction schema enum restricts the LLM to 6 types, none of which fit UI screens
2. `entity-resolver.ts` `resolveEntityIdentity` gates candidates by type equality before
   similarity — so even if a screen is eventually extracted with the correct type, it
   creates a duplicate node instead of merging with the prior `concept`-typed entry

## Goals / Non-Goals

**Goals:**

- Remove the type equality gate from `resolveEntityIdentity`
- Open the extraction schema to free-form type strings with a suggested list
- Add type normalization (lowercase + trim) in `extraction-client.ts`
- Add `screen` to the suggested type list; add `navigates_to` as a suggested edge type
- Update dedup prompt to be type-agnostic

**Non-Goals:**

- Changing the cosine similarity thresholds for merge/ambiguous decisions
- Adding a new deduplication strategy (those thresholds stay the same)

## Decisions

**Remove type gate entirely (not weaken it):**
The gate currently rejects candidates at `MERGE_THRESHOLD` (0.85) AND at
`AMBIGUOUS_THRESHOLD` (0.70) when types differ. Weakening (e.g. allow merge only when
types differ but similarity is very high) still creates blind spots. Removing it
entirely lets the LLM decide when types differ — which is already what the dedup prompt
is designed to do. The LLM has more context than a string equality check.

**Type normalization placement:**
Normalize in the `.map()` callback in `callExtractionLlm`, before any extracted entity
leaves the client. This means all downstream code (resolver, storage) always receives
normalized types. Single enforcement point.

**`navigates_to` as edge, not `navigation_action` as entity:**
Navigation facts like "Settings is accessed via the sidebar" are best represented as:

```
[Assets] --navigates_to--> [Settings]
```

not as a `navigation_action` entity node. Entity nodes should be nouns that accumulate
edges; actions are inherently relational. The extraction prompt already supports
free-form `relationshipType` on edges — add `navigates_to` to the suggested list.

**Dedup prompt update:**
Add explicit instruction: "Type differences alone are not a reason to return 'distinct'.
Two entities with different types may still be the same real-world object (e.g. 'Settings'
previously stored as 'concept' and now extracted as 'screen')."

## Risks / Trade-offs

- [Risk] Removing type gate may increase LLM dedup calls (more candidates pass to LLM
  step) → Mitigation: cosine similarity thresholds still gate candidates; only records
  above 0.70 similarity reach the LLM. In practice, type-mismatched candidates at high
  similarity are rare, so LLM call volume should increase marginally.
- [Risk] Existing test scenarios that assert `distinct` for type-mismatched entities
  will fail → Mitigation: update those tests to reflect new behavior (type mismatch →
  `llm-needed`, not `distinct`)
