## 1. Config

- [x] 1.1 Add `sessionId: string` as required field to `AmygdalaConfig` in `amygdala-schema.ts`

## 2. Write Path

- [x] 2.1 In `applyAction` (`amygdala-process.ts`), pass `sessionId: config.sessionId` on every `ltm.insert()` call
- [x] 2.2 Pass `episodeSummary: entry.text` on every `ltm.insert()` call
- [x] 2.3 After a successful `ltm.insert()` or `ltm.relate()`, immediately set `safeToDelete = true` on the associated context file record
- [x] 2.4 Ensure `safeToDelete` is NOT set if the LTM write throws or returns an error

## 3. Tests

- [x] 3.1 Unit test: inserted LTM record has `sessionId` matching `AmygdalaConfig.sessionId`
- [x] 3.2 Unit test: inserted LTM record has `episodeSummary` matching `InsightEntry.text`
- [x] 3.3 Unit test: context file `safeToDelete` is `true` after successful insert
- [x] 3.4 Unit test: context file `safeToDelete` remains `false` after failed LTM write
