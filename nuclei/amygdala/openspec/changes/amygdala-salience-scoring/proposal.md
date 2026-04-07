## Why

The amygdala scores all STM observations using a single conservative prompt that gives the LLM no explicit guidance on what makes an observation worth retaining. Research on the biological amygdala and AI memory systems (Generative Agents, Park et al. 2023; mem0 audit) shows that the critical signals — surprise/prediction error, self-relevance, and emotional valence — must be explicitly elicited to produce reliable salience discrimination. The current system forces the LLM to infer everything from raw text with no structured prompting, resulting in behavioral/reflective observations being underscored alongside routine noise.

## What Changes

- The amygdala scoring prompt is updated to explicitly ask the LLM to assess three salience dimensions: **surprise** (was this unexpected given prior context?), **self-relevance** (does this concern the agent's own patterns, preferences, or identity?), and **emotional valence** (is this emotionally significant — positive or negative?)
- `AmygdalaScoringResult` gains three optional scored dimensions (`surprise`, `selfRelevance`, `emotionalValence`), each 0.0–1.0, that feed into the final `importanceScore` computation
- The system prompt is restructured to use these dimensions as explicit scoring axes rather than asking for a single opaque importance number
- The existing `agentState` mechanism is preserved and extended: each state now modulates which dimension gets weighted more heavily (e.g., `stressed` boosts `emotionalValence`, `learning` boosts `surprise`)

## Capabilities

### New Capabilities

- `salience-dimensions`: Structured three-axis scoring (surprise, self-relevance, emotional valence) returned alongside the existing importance score

### Modified Capabilities

- `amygdala-scoring`: Scoring prompt and output schema change — the LLM now reasons across three explicit dimensions before producing an importance score

## Impact

- `nuclei/amygdala/src/amygdala-schema.ts` — schema, prompt builders, and constants
- `nuclei/amygdala/src/amygdala-process.ts` — `processEntry` uses new scoring fields
- `nuclei/amygdala/src/__tests__/amygdala-process.test.ts` — tests updated for new schema fields
- No changes to `InsightEntry` (stm), `apply-action.ts`, or LTM
