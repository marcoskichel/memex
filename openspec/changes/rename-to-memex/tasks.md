## 1. Prerequisites

- [x] 1.1 Merge `human-like-agent-memory` change branch
- [x] 1.2 Merge `port-neural-memory-db` change branch
- [x] 1.3 Verify `main` is green (`pnpm build && pnpm test`)

## 2. Config and Manifest Files

- [x] 2.1 Update root `package.json` name from `neurokit` to `memex`
- [x] 2.2 Update `packages/eslint-config/package.json` name from `@neurokit/eslint-config` to `@memex/eslint-config`
- [x] 2.3 Update `packages/typescript-config/package.json` name from `@neurokit/typescript-config` to `@memex/typescript-config`
- [x] 2.4 Update `packages/engram/package.json` name and all `@neurokit/*` devDependency references (skipped — engram deleted)
- [x] 2.5 Update remaining package `package.json` files (amygdala, hippocampus, ltm, stm, memory, cortex, claude-hooks) names and cross-references
- [x] 2.6 Update `packages/engram/tsconfig.json` and any other tsconfig files referencing `@neurokit` (engram parts skipped — deleted)
- [x] 2.7 Update `packages/engram/eslint.config.mjs` and root `eslint.config.mjs` references (engram parts skipped — deleted)
- [x] 2.8 Run `pnpm install` to regenerate lockfile with new package names
- [x] 2.9 Commit: `chore: rename package namespace from @neurokit to @memex`

## 3. Source and Test Files

- [x] 3.1 Find and replace all `@neurokit/` import paths in `.ts` source files across all packages
- [x] 3.2 Find and replace all `@neurokit/` references in `.ts` test files
- [x] 3.3 Run `pnpm build` and fix any compilation errors
- [x] 3.4 Run `pnpm test` and fix any test failures
- [x] 3.5 Commit: `chore: update @neurokit imports to @memex in source and tests`

## 4. Documentation and Name Origin

- [x] 4.1 Create `NAME.md` at repo root documenting the Memex etymology, what Bush's 1945 Memex was, why it fits this project, and alternatives considered
- [x] 4.2 Update `README.md` to reflect the new project name
- [x] 4.3 Commit: `docs: add NAME.md with Memex etymology and update README`

## 5. Repository

- [ ] 5.1 Rename GitHub repository from `neurokit` to `memex` (SKIPPED — manual action required)
- [ ] 5.2 Update any remote URLs in local git config if needed (SKIPPED — manual action required)
- [ ] 5.3 Run full `pnpm build && pnpm test` on clean install to verify everything works end-to-end
