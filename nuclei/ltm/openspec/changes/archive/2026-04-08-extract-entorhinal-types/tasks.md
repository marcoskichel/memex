## 1. Create @neurome/entorhinal package

- [ ] 1.1 Create `nuclei/entorhinal/` directory — copy package structure from `nuclei/ltm` as reference: needs `package.json` (with `build`, `lint`, `typecheck`, `check` scripts), `tsconfig.json`, `eslint.config.mjs`, and `src/index.ts`; omit `vitest.config.ts` (no tests — types only)
- [ ] 1.2 Verify `pnpm-workspace.yaml` already covers `nuclei/entorhinal` via the `nuclei/*` glob — no edit needed; just confirm
- [ ] 1.3 Add `nuclei/entorhinal` to `openspec/workspace.yaml` as a new scope

## 2. Move types to entorhinal

- [ ] 2.1 Define `EntityType`, `EntityNode`, `EntityEdge` (with `weight` field), `EntityPathStep`, `EntityMention`, `FindEntityPathParams` in `nuclei/entorhinal/src/index.ts`
- [ ] 2.2 Export all types from `nuclei/entorhinal/src/index.ts`

## 3. Update ltm to import from entorhinal

- [ ] 3.1 Add `@neurome/entorhinal` to `nuclei/ltm/package.json` dependencies
- [ ] 3.2 Remove `EntityType` from `src/ltm-engine-types.ts`; import from `@neurome/entorhinal`
- [ ] 3.3 Remove `EntityNode`, `EntityEdge`, `EntityPathStep`, `EntityMention`, `FindEntityPathParams` from `src/storage/storage-adapter.ts`; import from `@neurome/entorhinal`
- [ ] 3.4 Update `LtmQueryOptions.entityType` to reference `EntityType` from `@neurome/entorhinal`
- [ ] 3.5 Update `src/index.ts` re-exports — note two separate current sources: `EntityMention` and `EntityType` currently re-export from `./ltm-engine.js` (lines 37–38); `EntityNode`, `EntityEdge`, `EntityPathStep`, and `FindEntityPathParams` currently re-export from `./storage/storage-adapter.js` (lines 20–23). Change all of them to re-export from `@neurome/entorhinal`
- [ ] 3.6 Update all other `src/` files that reference these types to import from `@neurome/entorhinal`

## 4. Update external consumers

- [ ] 4.1 In `nuclei/cortex-ipc`: update `protocol.ts` re-exports of `EntityMention`, `EntityType` to source from `@neurome/entorhinal` (currently re-exported from `@neurome/ltm`)
- [ ] 4.2 In `nuclei/memory`: update `memory-types.ts` imports of `EntityNode` and `EntityPathStep` to import from `@neurome/entorhinal`
- [ ] 4.3 In `synapses/sdk`: add `@neurome/entorhinal` to `synapses/sdk/package.json` dependencies
- [ ] 4.4 In `synapses/sdk/src/types.ts`: remove the local `EntityType` definition and import it from `@neurome/entorhinal`

## 5. Verify

- [ ] 5.1 Run `pnpm run build` in `nuclei/entorhinal` — no errors
- [ ] 5.2 Run `pnpm run build` in `nuclei/ltm` — no type errors
- [ ] 5.3 Run `pnpm run test` in `nuclei/ltm` — all tests pass
- [ ] 5.4 Run `pnpm run build` in `nuclei/perirhinal` — no type errors (perirhinal has its own direct dep on `@neurome/entorhinal` from the perirhinal scope tasks)
