## 1. Remove adapter

- [x] 1.1 Delete `src/adapters/transformers-js-adapter.ts`
- [x] 1.2 Remove `TransformersJsAdapter` export from `src/index.ts`
- [x] 1.3 Remove `@xenova/transformers` from `package.json` dependencies

## 2. Verify

- [x] 2.1 Run `pnpm install` to update lockfile
- [x] 2.2 Run type-check and lint — confirm no remaining references
- [x] 2.3 Run tests — confirm all pass
- [ ] 2.4 Commit: `feat(ltm)!: drop TransformersJsAdapter and @xenova/transformers`
