## Context

The MCP recall tool (`recallMemory` in `handlers.ts`) currently serializes raw `MemoryRecallResult[]` to LLM consumers, stripping only the embedding vector. Everything else — internal IDs, hash tags, floating-point scores, embedding metadata, duplicate summary fields — is forwarded verbatim. This costs 3–4× more context tokens than necessary and obscures the superseded/companion relationship that the LTM pipeline deliberately constructs.

The LTM layer already handles companion injection: when a superseded record is retrieved, its superseding record is automatically added to the result set with `retrievalStrategies: ['companion']`. The linkage (which companion goes with which superseded record) is computed during `applySupersedes` as `supersedingIds: number[]` but is not currently surfaced in the output.

## Goals / Non-Goals

**Goals:**

- Reduce per-record token cost by ~70% through field stripping
- Make the superseded/companion relationship explicit via grouped `MemoryChange` units
- Replace raw score floats with a bucketed `relevance` label
- Keep all semantically meaningful signals (tier, entities, tags, recordedAt)

**Non-Goals:**

- Changing LTM retrieval logic, ranking, or companion injection behavior
- Modifying how `getContext` formats its output (separate handler, text-based output)
- Supporting rollback to old format (breaking change, clients must migrate)

## Decisions

### 1. Group superseded + companion as a `MemoryChange` unit

**Decision**: When `isSuperseded: true` and a companion exists in the result set, emit a single `MemoryChange` object instead of two flat records:

```typescript
type MemoryChange = {
  type: 'changed';
  current: MemoryEntry; // the superseding (companion) record
  supersedes: MemoryEntry; // the superseded (stale) record, with its own relevance
};

type MemoryEntry = {
  memory: string;
  tier: 'episodic' | 'semantic';
  relevance: 'high' | 'medium' | 'low';
  tags: string[];
  entities: EntityMention[];
  recordedAt: string; // ISO date, day precision
};

type RecallResult = MemoryEntry | MemoryChange;
```

**Why**: The grouped shape makes the tension legible — the LLM sees "current truth" alongside "stale but high-relevance memory" as a single unit, preventing false memory anchoring.

**Alternative considered**: Keep flat array, add explicit `supersededBy: number` field. Rejected — the LLM still has to mentally join two records. The grouped shape removes that burden.

### 2. Expose `supersedingIds` in LTM recall result

**Decision**: Add `supersedingIds: number[]` to `MemoryRecallResult` in `ltm-engine-types.ts`. The value is already computed in `applySupersedes` but not forwarded. This is a one-field addition, not a behavioral change.

**Why**: Without it, the cortex serialization layer cannot determine which companion belongs to which superseded record when multiple superseded records are in a single result set. Position-based matching would be fragile.

**Scope impact**: Touches `nuclei/ltm` minimally (type + result construction). The `cortex` change depends on this.

### 3. Bucket `effectiveScore` into `relevance` tiers

**Decision**: Map `effectiveScore` (float) to `"high" | "medium" | "low"`:

- `>= 0.7` → `"high"`
- `>= 0.5` → `"medium"`
- `< 0.5` → `"low"` (rare — LTM filters below 0.5 by default)

**Why**: LLMs parse ordinal labels more reliably than raw floats. The distinction between `0.553` and `0.548` carries no actionable signal.

### 4. Strip fields at the serialization layer

Fields removed from LLM output:

| Field                                   | Reason                                       |
| --------------------------------------- | -------------------------------------------- |
| `rrfScore`                              | Internal ranking implementation detail       |
| `embeddingMeta`                         | Irrelevant to reasoning                      |
| `accessCount`                           | System bookkeeping                           |
| `tombstoned`                            | Filtered server-side; never true in results  |
| `stability`                             | Internal decay parameter                     |
| `episodeSummary`                        | Redundant with `data` (renamed `memory`)     |
| Hash-format tags                        | Content-addressable IDs, zero semantic value |
| `insightId`, `engramId` (from metadata) | Internal graph identifiers                   |

**Why**: Every stripped field is either an implementation detail, a duplicate, or a value the LLM cannot reason about.

### 5. Rename `data` → `memory`

**Decision**: Use `memory` as the field name in the LLM-facing format.

**Why**: `data` is generic and carries no domain meaning. `memory` is self-documenting in context.

## Risks / Trade-offs

- **BREAKING change for all recall consumers** → Callers using the old format (SDK, direct IPC clients) must update. Mitigated by: single serialization point in `handlers.ts`; format change is additive at the IPC type level.
- **LTM scope dependency** → Adding `supersedingIds` to `MemoryRecallResult` is a prerequisite. It's a one-field addition but requires a cross-scope commit. Mitigated by: keeping changes minimal and non-behavioral.
- **Multiple companions per superseded record** → If multiple records supersede the same old record, `supersedingIds` will have multiple entries. Decision: take the first companion found in the result set.

## Migration Plan

1. Add `supersedingIds` to LTM result type (prerequisite, `ltm` scope)
2. Transform serialization in `handlers.ts` (`cortex` scope)
3. Update protocol types in `cortex-ipc`
4. Deploy — no database migration required; format change is in-memory serialization only
