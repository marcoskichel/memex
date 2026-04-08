## 1. Config and Types

- [x] 1.1 Add `AgentProfile` interface (`{ type?: string; purpose?: string }`) to `amygdala-schema.ts`
- [x] 1.2 Add optional `agentProfile?: AgentProfile` field to `AmygdalaConfig` interface
- [x] 1.3 Add optional `goalRelevance?: number` field to `AmygdalaScoringResult` interface
- [x] 1.4 Add `goalRelevance` to `amygdalaScoringSchema.shape` as `z.number().min(0).max(1).optional()`, clamped and defaulting to `undefined` when absent

## 2. Prompt Builder

- [x] 2.1 Update `buildSystemPrompt(agentState?, agentProfile?)` signature in `amygdala-schema.ts`
- [x] 2.2 Inject agent profile block BEFORE `SYSTEM_PROMPT` when `agentProfile` is present:
  - Type line omitted if `type` absent; purpose line omitted if `purpose` absent
  - Truncate `purpose` to 200 characters before injection
  - Include explicit goal-relevance instruction: "Use the agent's purpose to assess goal-relevance: observations that directly advance or reveal blockers to this purpose deserve higher scores, even if syntactically simple. Capture this in the goalRelevance dimension."
- [x] 2.3 Append agent state hint at the end, as today (order: profile block → SYSTEM_PROMPT → state hint)
- [x] 2.4 Add JSDoc to `AgentProfile.purpose` documenting the 200-char limit and prompt injection risk
- [x] 2.5 Update unit tests for `buildSystemPrompt`: no args, state only, profile only (type+purpose), profile only (purpose only), profile only (type only), both state and profile, purpose truncation at 200 chars

## 3. Process Wiring

- [x] 3.1 Add private `agentProfile` field to `AmygdalaProcess`
- [x] 3.2 Read `config.agentProfile` in constructor and store on instance
- [x] 3.3 Pass `this.agentProfile` into `buildSystemPrompt(this.agentState, this.agentProfile)` in `scoreWithRetry`

## 4. Tests

- [x] 4.1 Unit test: `AmygdalaProcess` constructed with `agentProfile` passes it into system prompt on scoring call
- [x] 4.2 Unit test: `AmygdalaProcess` constructed without `agentProfile` produces prompt identical to current behavior
- [x] 4.3 Integration test: navigation event `'Navigated from screen A to screen B via tap on Settings'` with `agentProfile = { purpose: 'Explore mobile app UI to identify bugs' }` → `importanceScore >= 0.5` and `goalRelevance >= 0.6`
- [x] 4.4 Integration test: same navigation event WITHOUT `agentProfile` → `importanceScore <= 0.3` and `goalRelevance` absent
- [x] 4.5 Integration test: same navigation event with `agentProfile = { purpose: 'Measure animation performance' }` → `goalRelevance <= 0.3`
- [x] 4.6 Unit test: any insight scored with `agentProfile` set → `goalRelevance` is defined (non-null) in the result, regardless of value
