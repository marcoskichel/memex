## 1. System Prompt

- [x] 1.1 Add canonical name instruction to `SYSTEM_PROMPT` in `amygdala-schema.ts`: prefer most complete proper name; use role/alias only when proper name is unknown
- [x] 1.2 Verify negative-example instructions remain intact alongside the new guidance

## 2. Entity Normalization

- [x] 2.1 Lowercase every `name` value in `parseEntities` in `amygdala-schema.ts` before pushing to result array
- [x] 2.2 Add unit tests in `amygdala-schema.test.ts` covering: uppercase name lowercased, mixed-case tool name lowercased, already-lowercase name unchanged, malformed input still returns `[]`

## 3. Verification

- [x] 3.1 Run existing amygdala test suite and confirm all tests pass
- [x] 3.2 Confirm no existing test asserts a mixed-case entity name (update any that do)
