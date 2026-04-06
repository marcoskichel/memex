## 1. Create cortex-ipc package

- [x] 1.1 Create `nuclei/cortex-ipc/` directory with `package.json` (`@neurome/cortex-ipc`)
- [x] 1.2 Add `tsconfig.json` and `vitest.config.ts` extending the shared configs
- [x] 1.3 Copy `src/ipc/protocol.ts` from `packages/cortex` into `nuclei/cortex-ipc/src/protocol.ts`
- [x] 1.4 Create `nuclei/cortex-ipc/src/index.ts` exporting all protocol types and `IPC_SOCKET_PATH`
- [x] 1.5 Verify `pnpm build` succeeds for `@neurome/cortex-ipc`

## 2. Move cortex daemon to synapses/

- [x] 2.1 `git mv packages/cortex synapses/cortex`
- [x] 2.2 Add `@neurome/cortex-ipc` as a dependency in `synapses/cortex/package.json`
- [x] 2.3 Update `synapses/cortex/src/ipc/protocol.ts` imports to use `@neurome/cortex-ipc` (or remove the file if all types are now from the new package)
- [x] 2.4 Update `synapses/cortex/src/index.ts` to re-export from `@neurome/cortex-ipc` instead of local ipc files
- [x] 2.5 Verify `pnpm build` succeeds for `@neurome/cortex`

## 3. Rename packages/ to nuclei/

- [x] 3.1 `git mv packages nuclei`
- [x] 3.2 Update `pnpm-workspace.yaml`: replace `packages/*` glob with `nuclei/*`
- [x] 3.3 Update `turbo.json` if it references `packages/` paths
- [x] 3.4 Update `openspec/workspace.yaml`: change all `path: packages/*` entries to `path: nuclei/*`, add `cortex-ipc` scope, update `cortex` path to `synapses/cortex`

## 4. Update consumer synapses

- [x] 4.1 In `synapses/afferent/package.json`: replace `@neurome/cortex` dep with `@neurome/cortex-ipc`
- [x] 4.2 Update `synapses/afferent` source imports from `@neurome/cortex` → `@neurome/cortex-ipc`
- [x] 4.3 In `synapses/claude-hooks/package.json`: replace `@neurome/cortex` dep with `@neurome/cortex-ipc`
- [x] 4.4 Update `synapses/claude-hooks` source imports from `@neurome/cortex` → `@neurome/cortex-ipc`
- [x] 4.5 In `synapses/neurome-tui/package.json`: replace `@neurome/cortex` dep with `@neurome/cortex-ipc`
- [x] 4.6 Update `synapses/neurome-tui` source imports from `@neurome/cortex` → `@neurome/cortex-ipc`

## 5. Verify full build

- [x] 5.1 Run `pnpm install` at monorepo root — no broken references
- [x] 5.2 Run `pnpm build` across all packages — no type errors
- [x] 5.3 Run `pnpm test` across all packages — all tests pass
- [x] 5.4 Grep for `packages/` in non-node_modules source — zero matches
- [x] 5.5 Grep for `from '@neurome/cortex'` in consumer synapses — zero matches
