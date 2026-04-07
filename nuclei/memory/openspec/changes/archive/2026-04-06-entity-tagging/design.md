## Context

`Memory.recall()` is typed as `recall(nlQuery: string, options?: LtmQueryOptions)`. Since `LtmQueryOptions` is imported directly from `@neurome/ltm`, when ltm adds `entityName` and `entityType` to `LtmQueryOptions`, those fields become available to `memory.recall()` callers automatically at the type level. The runtime passthrough already exists — no new plumbing is required.

## Goals / Non-Goals

**Goals:**

- Confirm entity filter options surface through `memory.recall()` without code changes
- Add an integration test validating end-to-end entity filtering through the memory facade

**Non-Goals:**

- Any new memory API surface
- Changes to `logInsight()` or `recallSession()`

## Decisions

**No new code.** The `memory` package's role here is purely confirmatory — verify the passthrough works, add a test, close the scope. If a code change is needed it indicates a bug in the passthrough, not a feature gap.

## Risks / Trade-offs

- Low risk. The only change is a transitive type update from `@neurome/ltm`. If ltm's `LtmQueryOptions` update is not published before memory is tested, type errors will surface — resolved by build order in turbo.
