## 1. Wire Default

- [ ] 1.1 In `src/memory-impl.ts`, update the `recall()` method to spread `{ minResults: 1, ...options }` when calling `ltm.query()` so caller-supplied values override the default

## 2. Tests

- [ ] 2.1 Add test: `memory.recall()` with no threshold-passing records returns 1 record when a candidate with similarity > 0.05 exists
- [ ] 2.2 Add test: `memory.recall('q', { minResults: 0 })` returns empty when no records pass threshold
- [ ] 2.3 Add test: `memory.recallSession()` is unaffected (still returns empty when no records pass)
- [ ] 2.4 Run `pnpm check` in `packages/memory`, fix any lint/type errors
