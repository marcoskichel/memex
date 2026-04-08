## 0. Prerequisite check

- [ ] 0.1 Confirm `extract-entorhinal-types` has been applied: verify `nuclei/entorhinal/src/index.ts` exists and exports `EntityType`. If it does not exist, this change cannot be applied as written — patch `EntityType` directly in `nuclei/ltm/src/ltm-engine-types.ts` line 4 instead (change the closed union to `export type EntityType = string`).

## 1. Widen EntityType in entorhinal

- [ ] 1.1 In `nuclei/entorhinal/src/index.ts`, change `EntityType` from a closed union to `export type EntityType = string`
      (Coordinate with perirhinal scope: only one apply needs to make this edit — the other scope's task 1.1 is a no-op if already done)

## 2. Verify LTM accepts open type

- [ ] 2.1 In `nuclei/ltm/src/ltm-engine-types.ts`: if `EntityType` is still defined locally as a closed union (i.e. `extract-entorhinal-types` not yet applied), change it to `export type EntityType = string`. If it already imports from `@neurome/entorhinal`, the widening in task 1.1 is sufficient — no further edit needed here.
- [ ] 2.2 Search `nuclei/ltm/src/` for any test or code that switches/exhaustively checks `EntityType` values — confirm none rely on closed-union exhaustiveness
- [ ] 2.3 In `src/core/query-filters.ts`, normalize the `entityType` filter value at query time: apply `.toLowerCase().trim()` to the incoming `entityType` option before the string equality check against `entity.type`. This matches the normalization applied during extraction (perirhinal task 3.4) — without it, a query for `entityType: 'Screen'` would silently return zero results even though `'screen'` records exist
- [ ] 2.4 Run `pnpm run build` in `nuclei/ltm` — no type errors
- [ ] 2.5 Run `pnpm run test` in `nuclei/ltm` — all tests pass
