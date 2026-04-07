## Context

The amygdala scores each STM entry by asking an LLM to produce a single `importanceScore` (0.0–1.0) with a conservative bias. The prompt tells the LLM what actions to take and what entities to extract, but gives no explicit guidance on _why_ something should score high. The LLM must infer salience from raw text alone.

Research on biological amygdala gating and AI memory systems (Generative Agents, Park et al. 2023) identifies three independently-grounded signals that drive whether something is worth retaining:

- **Surprise / prediction error** — was this unexpected? (dopaminergic mechanism)
- **Self-relevance** — does this concern the agent's own identity, patterns, or preferences? (mPFC self-reference effect; +30% recall)
- **Emotional valence** — is this emotionally significant, positively or negatively?

The existing `agentState` mechanism (focused/idle/stressed/learning) is a correct global modulator — it adjusts the system's baseline sensitivity. It is preserved as-is.

## Goals / Non-Goals

**Goals:**

- Add three explicit salience dimensions to the scoring schema: `surprise`, `selfRelevance`, `emotionalValence`
- Restructure the system prompt to elicit explicit reasoning on each dimension before producing `importanceScore`
- Extend `agentState` hints to reference which dimension to weight more under each state
- Keep `importanceScore` as the single downstream signal used by `apply-action.ts`

**Non-Goals:**

- Pre-classification of thought types (operational vs behavioral) — not grounded in the research
- Adding a `reject` action or modifying `apply-action.ts`
- Reflection synthesis trigger (Generative Agents-style cumulative threshold) — deferred
- Modifying `InsightEntry` or any package outside `amygdala`

## Decisions

**1. Dimensions are added to `AmygdalaScoringResult` as optional fields (0.0–1.0 each)**

The three dimensions are optional (`surprise?: number`, `selfRelevance?: number`, `emotionalValence?: number`) so existing consumers and tests that don't reference them are unaffected. The `parse()` function clamps each to [0, 1] and defaults to `undefined` if absent.

Alternative considered: make them required. Rejected because it would break all existing test fixtures that construct `AmygdalaScoringResult` directly.

**2. `importanceScore` remains the single downstream signal — dimensions inform it, not replace it**

The prompt instructs the LLM to reason across all three dimensions and then synthesize a single `importanceScore`. We do not compute `importanceScore` mechanically from the dimensions (e.g. weighted average) in code. The LLM's synthesis is the scoring step. This preserves the LLM's ability to weight dimensions contextually per observation.

Alternative considered: compute importance from dimensions via formula. Rejected because it would require calibrating weights empirically and would bypass the LLM's contextual reasoning.

**3. System prompt restructured into explicit reasoning steps**

The new prompt asks the LLM to assess each dimension in order before arriving at importance. This mirrors chain-of-thought prompting and is consistent with the empirical finding (from the 2025 memory management paper) that structural separation outperforms richer single prompts.

**4. `agentState` hints updated to reference dimensions**

Each state hint now names which dimension it affects:

- `focused`: raise bar for low-selfRelevance, low-surprise content
- `stressed`: weight emotionalValence more heavily
- `learning`: weight surprise more heavily
- `idle`: score all dimensions normally

**5. Schema field added to `amygdalaScoringSchema.shape` and `parse()`**

The three fields are added to the structured output schema so the LLM can return them reliably. The `parse()` function handles missing/malformed values gracefully (defaults to `undefined`).

## Risks / Trade-offs

[LLM drift on dimension scores] → Dimensions are informational; only `importanceScore` drives downstream behavior. Drift in dimension scores cannot break the consolidation pipeline.

[Increased token usage per call] → The restructured prompt is slightly longer and elicits more reasoning tokens. Estimated +100–200 tokens per call. Acceptable given the rate-limiting already in place.

[Dimension scores unused in current downstream] → `apply-action.ts` and LTM do not use the dimension fields today. They are stored on the result but have no behavioral effect yet. This is intentional — they become available for future use (e.g., reflection trigger weighting, LTM metadata).
