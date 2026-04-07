## 1. Schema

- [ ] 1.1 Add `surprise`, `selfRelevance`, `emotionalValence` optional fields to `AmygdalaScoringResult` interface in `amygdala-schema.ts`
- [ ] 1.2 Add the three dimension fields to `amygdalaScoringSchema.shape` as optional numbers
- [ ] 1.3 Update `amygdalaScoringSchema.parse()` to extract and clamp each dimension to [0, 1], defaulting to `undefined` if absent or malformed

## 2. System Prompt

- [ ] 2.1 Restructure `SYSTEM_PROMPT` to define the three salience dimensions with brief descriptions (surprise, self-relevance, emotional valence)
- [ ] 2.2 Add explicit instruction for the LLM to assess each dimension before producing `importanceScore`, and to let the combined signal drive it
- [ ] 2.3 Update each `AGENT_STATE_HINTS` entry to reference the relevant dimension it weights

## 3. Tests

- [ ] 3.1 Update `amygdala-schema.test.ts`: add test cases for dimension extraction, clamping, and missing-field defaults in `parse()`
- [ ] 3.2 Update `amygdala-process.test.ts`: ensure mock LLM responses that include dimension fields are handled correctly end-to-end
- [ ] 3.3 Add a test asserting `buildSystemPrompt()` output contains all three dimension labels

## 4. Verification

- [ ] 4.1 Run the full test suite (`pnpm test`) and confirm all tests pass
- [ ] 4.2 Review the updated system prompt text for clarity and brevity
