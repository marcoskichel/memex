## 1. Add dependency

- [ ] 1.1 Add `@neurome/entorhinal` to `nuclei/perirhinal/package.json` dependencies

## 2. Update type imports

- [ ] 2.1 Remove `EntityType` local definition from `src/core/types.ts` (note: `EntityMention` is NOT defined locally — it is already imported from `@neurome/ltm`; do not look for it in `types.ts`)
- [ ] 2.2 Import `EntityType` from `@neurome/entorhinal` in `src/core/types.ts`
- [ ] 2.3 Update `ExtractedEntity.type` to use `EntityType` from `@neurome/entorhinal`
- [ ] 2.4 Remove the `entity.type as ExtractedEntity['type']` cast in `src/shell/clients/extraction-client.ts`

## 3. Fix downstream references

- [ ] 3.1 Update `src/index.ts` re-export of `EntityType` — change import source from local `./types.js` to `@neurome/entorhinal` (do this atomically with 2.1: removing the local definition in 2.1 will break the build until 3.1 is also applied)
- [ ] 3.2 Update any other files in `src/` that import `EntityType` from local `types.ts` to import from `@neurome/entorhinal`

## 4. Verify

- [ ] 4.1 Run `pnpm run build` in `nuclei/perirhinal` — no type errors
- [ ] 4.2 Run `pnpm run test` in `nuclei/perirhinal` — all tests pass
