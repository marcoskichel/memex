## 1. Rename Package Names

- [ ] 1.1 Update `package.json` name in every package: `@memex/amygdala` → `@neurome/amygdala`, `@memex/cortex` → `@neurome/cortex`, `@memex/hippocampus` → `@neurome/hippocampus`, `@memex/ltm` → `@neurome/ltm`, `@memex/llm` → `@neurome/llm`, `@memex/memory` → `@neurome/memory`, `@memex/stm` → `@neurome/stm`, `@memex/eslint-config` → `@neurome/eslint-config`, `@memex/typescript-config` → `@neurome/typescript-config`
- [ ] 1.2 Update `package.json` name in every synapse: `@memex/afferent` → `@neurome/afferent`, `@memex/claude-hooks` → `@neurome/claude-hooks`, `@memex/memex-tui` → `@neurome/neurome-tui`
- [ ] 1.3 Update root `package.json`: name `@memex/root` → `@neurome/root`, all `@memex/*` references in scripts and dependencies

## 2. Update All Import Paths

- [ ] 2.1 Run global find-and-replace of `@memex/` → `@neurome/` across all `.ts`, `.tsx`, `.js`, `.json` files (excluding `node_modules`)
- [ ] 2.2 Verify no remaining `@memex` references: `grep -r "@memex" --include="*.ts" --include="*.json" --include="*.yaml" . | grep -v node_modules`

## 3. Update Socket Path

- [ ] 3.1 In `packages/cortex/src/ipc/protocol.ts` line 11: change `` `/tmp/memex-${sessionId}.sock` `` → `` `/tmp/neurome-${sessionId}.sock` ``
- [ ] 3.2 Update any test fixtures referencing `memex-` socket paths in `packages/cortex/src/__tests__/`

## 4. Rename memex-tui

- [ ] 4.1 `git mv synapses/memex-tui synapses/neurome-tui`
- [ ] 4.2 Update `openspec/workspace.yaml`: change `memex-tui` scope name and path to `neurome-tui` / `synapses/neurome-tui`
- [ ] 4.3 Update any internal references to the `memex-tui` path in root `package.json` scripts

## 5. Relink and Verify

- [ ] 5.1 Run `pnpm install` to relink all workspace packages under the new names
- [ ] 5.2 Run `pnpm build` from root to confirm all packages resolve and compile
- [ ] 5.3 Run `pnpm test` (or `pnpm check`) across the workspace to confirm no broken imports
- [ ] 5.4 Final grep: `grep -r "memex" . --include="*.ts" --include="*.json" --include="*.yaml" | grep -v node_modules | grep -v ".git"` — fix any stragglers
