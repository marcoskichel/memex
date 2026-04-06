## 1. Query Constants

- [x] 1.1 Define `SECONDARY_QUERY_LIMIT = 2` and the two static secondary query strings as named constants in `packages/cortex/src/ipc/handlers.ts`

## 2. Fan-out Implementation

- [x] 2.1 Rewrite `getContext` to issue three parallel `memory.recall()` calls via `Promise.all`
- [x] 2.2 Primary query: `JSON.stringify(payload.toolInput)` with `limit: RECALL_LIMIT_FOR_CONTEXT`
- [x] 2.3 Secondary query 1: `"current user identity, agent goals, session context"` with `limit: SECONDARY_QUERY_LIMIT`
- [x] 2.4 Secondary query 2: `"project being built, architectural decisions, codebase overview"` with `limit: SECONDARY_QUERY_LIMIT`

## 3. Merge Logic

- [x] 3.1 Filter out failed query results (`isErr()`) without throwing
- [x] 3.2 Flatten all successful results into a single array
- [x] 3.3 Deduplicate by `record.id`, keeping the first (highest-scoring) occurrence
- [x] 3.4 Sort merged array by `effectiveScore` descending
- [x] 3.5 Slice to `RECALL_LIMIT_FOR_CONTEXT`

## 4. Tests

- [x] 4.1 Add unit test: three queries are issued per `getContext` call
- [x] 4.2 Add unit test: duplicate records across queries are deduplicated by ID
- [x] 4.3 Add unit test: results are sorted by effectiveScore descending
- [x] 4.4 Add unit test: result count does not exceed `RECALL_LIMIT_FOR_CONTEXT`
- [x] 4.5 Add unit test: secondary query failure returns partial results without throwing
- [x] 4.6 Add unit test: primary query failure with successful secondary queries still returns results

## 5. Verification

- [x] 5.1 Run `pnpm lint` and `pnpm test` in `packages/cortex` — all green
- [ ] 5.2 Manual smoke test: start cortex with some identity insights in LTM, call `getContext` with an unrelated tool input — verify identity records appear in the response
