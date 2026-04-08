## 0. Prerequisite check

- [ ] 0.1 Confirm `extract-entorhinal-types` has been applied: verify `nuclei/entorhinal/src/index.ts` exists and exports `EntityType`. If it does not exist, this change cannot be applied as written — patch `EntityType` directly in `nuclei/perirhinal/src/core/types.ts` and `nuclei/ltm/src/ltm-engine-types.ts` instead.

## 1. Widen EntityType

- [ ] 1.1 In `nuclei/entorhinal/src/index.ts`, change `EntityType` from a closed union to `export type EntityType = string`

## 2. Remove type gate from entity-resolver

- [ ] 2.1 In `src/core/entity-resolver.ts`, remove `candidate.type === extracted.type` gate from the MERGE_THRESHOLD branch
- [ ] 2.2 In `src/core/entity-resolver.ts`, remove `candidate.type === extracted.type` gate from the AMBIGUOUS_THRESHOLD branch
- [ ] 2.3 Update tests in `entity-extraction-process.test.ts` that assert `distinct` for type-mismatched entities at high cosine similarity — they should now assert `merge` or `llm-needed`

## 3. Update extraction client schema and prompt

- [ ] 3.1 In `src/shell/clients/extraction-client.ts`, remove `enum` from the entity `type` field in `EXTRACTION_SCHEMA`
- [ ] 3.2 Add a `description` to the entity `type` field listing suggested types: `person`, `project`, `concept`, `preference`, `decision`, `tool`, `screen`
- [ ] 3.3 Add `navigates_to` to the suggested edge `relationshipType` description in `EXTRACTION_SCHEMA`
- [ ] 3.4 In the `.map()` callback in `callExtractionLlm`, add type normalization: `entity.type.toLowerCase().trim()`

## 4. Update deduplication prompt

- [ ] 4.1 In `callDeduplicationLlm`, add a sentence to the prompt: "Type differences alone are not a reason to return 'distinct' — evaluate based on name and meaning."

## 5. Verify

- [ ] 5.1 Run `pnpm run build` in `nuclei/perirhinal` — no type errors
- [ ] 5.2 Run `pnpm run test` in `nuclei/perirhinal` — all tests pass
