## 1. Dependencies

- [x] 1.1 Add `@neurome/cortex-ipc` as a dependency in `nuclei/amygdala/package.json`

## 2. Schema Changes

- [x] 2.1 Import `EntityMention` from `@neurome/cortex-ipc` in `amygdala-schema.ts`
- [x] 2.2 Add `entities: EntityMention[]` to `AmygdalaScoringResult` interface
- [x] 2.3 Add `entities` array field to `amygdalaScoringSchema.shape`
- [x] 2.4 Update `amygdalaScoringSchema.parse` to extract and validate `entities`, defaulting to `[]` on missing/invalid input

## 3. Prompt Update

- [x] 3.1 Extend `SYSTEM_PROMPT` with entity extraction instructions and negative examples (no pronouns, no abstract nouns, no temporal expressions)

## 4. Process Wiring

- [x] 4.1 Confirm `AmygdalaProcess` passes `entities` from the scoring result to the LTM insert call's `metadata`

## 5. Tests

- [x] 5.1 Unit test: `amygdalaScoringSchema.parse` with valid entities array
- [x] 5.2 Unit test: `amygdalaScoringSchema.parse` with missing `entities` field returns `[]`
- [x] 5.3 Unit test: `amygdalaScoringSchema.parse` with malformed `entities` returns `[]`
- [x] 5.4 Run `pnpm test` in `nuclei/amygdala` and confirm green
