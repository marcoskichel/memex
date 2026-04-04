## Context

`Memory` is the sole public interface for agent code. Two new retrieval methods surface the new LTM fields: `recallSession` wraps `ltm.query()` with a fixed `sessionId` filter, and `recallFull` fetches a record by ID and returns its `episodeSummary`. Both are thin wrappers — no new logic, just ergonomic surfaces over existing LTM capabilities.

## Goals / Non-Goals

**Goals:**

- Expose `recallSession()` and `recallFull()` on the `Memory` interface
- Wire `sessionId` from `MemoryConfig` through the factory to `AmygdalaConfig`

**Non-Goals:**

- Changing `recall()` behaviour (strengthen default is a separate blocked item)
- Exposing raw LTM query options on `recallSession` beyond what is useful at the agent level

## Decisions

### `recallSession` accepts an optional `LtmQueryOptions` override

Agents may want to further filter by `tier`, `category`, or `after`/`before` within a session. Accepting `LtmQueryOptions` as a third argument (minus `sessionId`, which is fixed) gives full flexibility without a bespoke parameter list.

### `recallFull` returns `episodeSummary: string | null`, not `string | undefined`

`null` is the explicit signal that the record exists but has no episode summary (semantic record or pre-migration episodic). `undefined` would be ambiguous with a missing field. The return type uses `null` explicitly.

### `sessionId` required on `MemoryConfig`

Every `Memory` instance is scoped to a session by design. Making `sessionId` optional would allow silent misconfiguration where amygdala writes records with no useful session discriminator. Required is the correct default; callers that genuinely don't care about session scoping can pass a constant (e.g. `'default'`).
