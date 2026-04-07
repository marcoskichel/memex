## 1. Type Definitions

- [ ] 1.1 Add `EntityType` string union and `EntityMention` interface to `src/index.ts`
- [ ] 1.2 Verify exports are visible from package root (typecheck passes)

## 2. Tests

- [ ] 2.1 Add compile-time type tests asserting `EntityMention` rejects unknown `type` values
- [ ] 2.2 Run `pnpm typecheck` in `nuclei/cortex-ipc` and confirm no errors
