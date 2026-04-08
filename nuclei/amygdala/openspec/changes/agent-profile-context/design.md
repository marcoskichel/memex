## Context

`buildSystemPrompt(agentState?)` in `amygdala-schema.ts` appends a one-line state hint to `SYSTEM_PROMPT` when `agentState` is set. `agentProfile` extends this function with a second parameter. The profile block is injected BEFORE importance scoring instructions to prime the LLM's reasoning frame rather than appending it as an afterthought. `AmygdalaConfig` already accepts `agentState?`; `agentProfile?` follows the same pattern.

## Goals / Non-Goals

**Goals:**

- Add `agentProfile?: { type?: string; purpose?: string }` to `AmygdalaConfig`
- Thread it through `AmygdalaProcess` into `buildSystemPrompt`
- Inject profile context BEFORE importance scoring instructions when present
- Add `goalRelevance?: number` to `AmygdalaScoringResult` — the structured output of purpose-driven assessment

**Non-Goals:**

- No pre-classification or heuristics on insight text
- No per-agent-type hardcoded rules or routing logic
- No changes to `apply-action.ts` or the downstream pipeline
- No breaking changes to existing `AmygdalaConfig` consumers

## Decisions

### D1: `agentProfile` mirrors the `agentState` pattern exactly

`agentState` is stored as a private field, set at construction, injected into `buildSystemPrompt` at each `scoreWithRetry` call. `agentProfile` follows the same shape: optional config field, private process field, passed into `buildSystemPrompt`.

**Rejected**: Creating `buildSystemPromptWithProfile` — duplicates composition logic. One function with two optional params is sufficient.

### D2: Profile block appears BEFORE importance scoring instructions

Agent state currently appends a hint at the end. Profile is different — it establishes the evaluative frame the LLM uses for the entire scoring pass. Priming with purpose before scoring instructions produces more consistent goal-relevant scoring than appending it as trailing context.

**Prompt shape when both present:**

```
<AGENT PROFILE BLOCK>

Agent Profile:
- Type: <type>        ← omitted if absent
- Purpose: <purpose>  ← omitted if absent, truncated to 200 chars

Use the agent's purpose to assess goal-relevance: observations that directly
advance or reveal blockers to this purpose deserve higher scores, even if
syntactically simple. Capture this in the goalRelevance dimension.

<SYSTEM_PROMPT (importance scoring instructions)>

Current agent state: <state hint>  ← appended at end, as today
```

When only one field is present, the other line is omitted. When neither `agentProfile` nor `agentState` is set, output is unchanged from today.

### D3: `goalRelevance` is this change's schema extension, building on `amygdala-salience-scoring`

`amygdala-salience-scoring` establishes `surprise`, `selfRelevance`, `emotionalValence` as intrinsic salience signals. `goalRelevance` is an extrinsic signal — it only has meaning when a purpose is stated. Adding it here (rather than in `amygdala-salience-scoring`) keeps it coupled to `agentProfile`: when no profile is set, `goalRelevance` is absent from the schema entirely. This preserves backward compatibility and makes the dependency explicit.

**goalRelevance** is added to `amygdalaScoringSchema.shape` as an optional `z.number().min(0).max(1)` field, clamp-defaulting to `undefined` when absent. The prompt instructs the LLM to populate it using the agent's stated purpose.

### D4: `purpose` is truncated to 200 chars before injection

Free-text `purpose` is a prompt injection surface. Truncation at 200 chars bounds the risk without requiring runtime validation. `AmygdalaConfig` JSDoc documents this contract so callers know to validate or source from trusted origins.

## Risks / Trade-offs

- [Token cost] Profile block adds ~50–100 tokens per scoring call. Negligible against `ESTIMATED_TOKENS_PER_CALL`. → No mitigation needed.
- [LLM drift] Ambiguous purpose produces inconsistent `goalRelevance` scores. → Callers own purpose quality; no enforcement in the library.
- [Prompt injection] Malicious `purpose` strings. → Mitigated by 200-char truncation and JSDoc guidance. Low risk when profile comes from agent config (trusted source).

## Open Questions

None. Change is fully self-contained within `nuclei/amygdala`.
