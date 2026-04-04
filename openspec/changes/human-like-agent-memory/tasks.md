## 1. Repo & Workspace Setup

- [ ] 1.1 Rename `packages/engram` → `packages/ltm`; update `package.json` name to `@neurokit/ltm`
- [ ] 1.2 Update `openspec/workspace.yaml`: scope `engram` → `ltm`, path → `packages/ltm`
- [ ] 1.3 Scaffold `packages/stm` with `package.json` (`@neurokit/stm`), `tsconfig.json`, `vitest.config.ts`, `eslint.config.mjs`
- [ ] 1.4 Scaffold `packages/amygdala` with same tooling
- [ ] 1.5 Scaffold `packages/hippocampus` with same tooling
- [ ] 1.6 Scaffold `packages/memory` with same tooling
- [ ] 1.7 Register all new packages in `pnpm-workspace.yaml` and `turbo.json`
- [ ] 1.8 Verify `turbo build` resolves the full dependency graph across all 5 packages

## 2. Final Integration & CI

- [ ] 2.1 Run full test suite across all packages (`pnpm vitest run`) — all green
- [ ] 2.2 Run `turbo build` — all packages compile without errors
- [ ] 2.3 Run linter across all packages — no errors
- [ ] 2.4 Do a PR review of all changes as if reviewing another engineer's work
- [ ] 2.5 Apply any recommended fixes from review and re-run tests
- [ ] 2.6 Remove any unnecessary comments from all changed files
