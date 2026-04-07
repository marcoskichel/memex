## 1. Type Definitions

- [x] 1.1 Add `EntityType` string union and `EntityMention` interface to `src/index.ts`
- [x] 1.2 Verify exports are visible from package root (typecheck passes)

## 2. Tests

- [x] 2.1 Add compile-time type tests asserting `EntityMention` rejects unknown `type` values
- [x] 2.2 Run `pnpm typecheck` in `nuclei/cortex-ipc` and confirm no errors
