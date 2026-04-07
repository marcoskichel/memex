## 1. Preserve openspec artifacts

- [ ] 1.1 Commit openspec change files before directory deletion

## 2. Remove package

- [ ] 2.1 Delete `synapses/claude-hooks/` directory
- [ ] 2.2 Run `pnpm install` to update lockfile

## 3. Verify

- [ ] 3.1 Confirm no references remain in the monorepo (`grep -r "claude-hooks" --include="*.json" .`)
- [ ] 3.2 Commit: `feat(claude-hooks)!: drop claude-hooks package`
