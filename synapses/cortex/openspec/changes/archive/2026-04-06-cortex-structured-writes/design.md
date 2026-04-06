## Context

The cortex daemon intercepts Claude tool calls via a pre-tool-use hook and logs them to memory via `logInsight`. Currently these log entries are unstructured strings with no tags, no agent identity, and no event-type semantics. The `@memex/afferent` synapse already defines the correct model: each event type maps to a human-readable summary and a set of semantic tags (`tool:<name>`, `navigation`, `agent:<name>`, `run:<runId>`).

The fix is to apply the afferent translation logic inside the cortex hook path, without changing the `logInsight` IPC interface.

## Goals / Non-Goals

**Goals:**

- Hook-logged insights are indistinguishable in format and tag richness from afferent-emitted insights
- A stable `run:<runId>` tag groups all insights for a cortex session
- `agent:claude` (or equivalent) tag identifies the originating agent on every insight
- No changes to the `logInsight` IPC protocol or `@memex/memory` interfaces

**Non-Goals:**

- Changing the afferent synapse (it is the reference implementation, not the target)
- Supporting `THOUGHT`, `STAGE_START`, or `STAGE_END` event types from the hook (cortex only intercepts tool calls)
- Logging tool results from the hook (post-tool-use hook is a separate concern)

## Decisions

### Decision: Inline translation in the hook, not a shared library

The translation logic (summary format, tag generation) will live in `packages/cortex/src/bin/cortex-core.ts` or a co-located helper, not extracted to a shared package.

**Rationale:** The afferent synapse is a separate distribution artifact for external agent code. Creating a shared package just for summary formatting increases coupling without benefit — the format is simple and stable. If divergence becomes a problem, extract then.

**Alternatives considered:** Importing from `@memex/afferent` — rejected because afferent is designed as a standalone synapse, not an internal library. It would create an odd dependency direction (cortex depending on a synapse).

### Decision: `agent:claude` as the identity tag, `run:<sessionId>` for grouping

The cortex session already has a `sessionId`. Using it as the `runId` avoids generating a second UUID and means all insights from a cortex session are naturally grouped.

**Rationale:** The afferent synapse generates a fresh UUID per `createAfferent()` call because multiple afferent instances can run in the same cortex session. Cortex has exactly one hook integration per session, so reusing `sessionId` is simpler and equally correct.

### Decision: Truncate serialized tool input to 500 chars in the summary

Consistent with afferent's `MAX_RESULT_LENGTH = 500` for tool results. Keeps summaries human-scannable and avoids bloating STM entries.

## Risks / Trade-offs

[Format mismatch drift] → The cortex hook and afferent synapse can diverge if one is updated without the other. Mitigation: the spec for `structured-hook-events` documents the exact format; both implementations should reference it.

[Agent identity hardcoded as `agent:claude`] → If cortex is ever used with a non-Claude agent, the tag will be wrong. Mitigation: make the agent name configurable in `CortexConfig`; default to `claude`.
