## Context

`memory.recall()` delegates to `ltm.query(nlQuery, options)`. The `options` object is passed through from the caller. Adding a default `minResults: 1` at this layer means all recall calls — including the three parallel queries in `cortex/handlers.ts` `getContext` — benefit without any caller changes.

## Goals / Non-Goals

**Goals:**

- Wire `minResults: 1` as the default for all `memory.recall()` calls
- Allow callers to override (pass `{ minResults: 0 }` for strict mode)

**Non-Goals:**

- Changing the ltm query logic (that is the ltm scope's change)
- Setting a default on `recallSession` or `recallFull` (those are specific lookups, not open queries)

## Decisions

**Default only in `recall()`, not `recallSession`**
`recallSession` is a targeted lookup (specific session + query) where empty results are informative. `recall()` is the open-ended query path where empty results cause problems. Default applied only to `recall()`.

**Spread pattern preserves caller overrides**

```ts
ltm.query(nlQuery, { minResults: 1, ...options });
```

Caller-supplied `minResults` in `options` wins via spread order.

## Risks / Trade-offs

**[Risk]** Callers relying on empty results as a "nothing found" signal will now always get at least one record → Mitigation: `{ minResults: 0 }` opts back out. Existing callers that don't pass `minResults` get the new behaviour — this is intentional.
