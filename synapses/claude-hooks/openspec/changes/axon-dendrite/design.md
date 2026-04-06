## Context

`cortex-socket-client.ts` implements `sendLogInsight` and `getContext` using ad-hoc per-request connections with hard-coded 50ms/200ms timeouts and correlation ID `"1"`. It is used by `pre-tool-use` and `post-tool-use` hook binaries. Both are short-lived processes (one tool call = one process invocation), so connection persistence is less critical here than in long-running consumers.

## Goals / Non-Goals

**Goals:**

- Delete `cortex-socket-client.ts`
- Replace call sites with `@memex/axon` equivalents
- Preserve all requirements from the `hook-socket-client` spec (50ms/200ms timeouts, exit-0-on-failure, session ID resolution)

**Non-Goals:**

- Changing hook behavior or output
- Persistent connections for hook processes (they are short-lived)

## Decisions

**Lazy-connect / single-use axon instance per hook invocation**
Each hook binary runs once and exits. A persistent connection would be overkill. `axon` in lazy-connect mode (connects on first call, no background reconnect) is the right fit. After the call completes, the binary exits and the socket closes.

**Timeout handling stays in the hook binaries**
The 50ms and 200ms timeouts are requirements of the hook spec, not of axon. Hook binaries pass `timeoutMs` to each axon call. Any error (including timeout) is caught and results in exit 0, preserving existing behavior.

**Session ID resolution logic stays in hooks**
`MEMORY_SESSION_ID` env var → `payload.session_id` → skip. This is hook domain logic, not transport logic. It stays in the hook binaries.

## Risks / Trade-offs

**[Risk]** axon's error types differ from current silent swallow → Mitigation: hook binaries wrap all axon calls in try/catch and exit 0 on any error. Behavior is preserved.

## Migration Plan

1. Add `@memex/axon` dependency to `claude-hooks`.
2. Update `pre-tool-use.ts` to call `axon.getContext(payload, { timeoutMs: 200 })` wrapped in try/catch.
3. Update `post-tool-use.ts` to call `axon.logInsight(payload, { timeoutMs: 50 })` in fire-and-forget mode.
4. Delete `shell/clients/cortex-socket-client.ts` and its test file.
