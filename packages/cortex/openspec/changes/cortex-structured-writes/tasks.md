## 1. Config Extension

- [x] 1.1 Add optional `agentName` field to `CortexConfig` in `packages/cortex/src/bin/cortex-core.ts`, defaulting to `"claude"`
- [x] 1.2 Read `agentName` from env or config and pass it through to the hook registration

## 2. Hook Translation Logic

- [x] 2.1 Create a `buildHookInsight(toolName, input, sessionId, agentName)` helper in `packages/cortex/src/` that produces `{ summary, tags }` matching the structured-hook-events spec
- [x] 2.2 Truncate serialized input to 500 chars in the summary
- [x] 2.3 Assemble tags: `['navigation', 'tool:<toolName>', 'agent:<agentName>', 'run:<sessionId>']`

## 3. Hook Integration

- [x] 3.1 Replace the existing raw `logInsight` call in the pre-tool-use hook with a call using `buildHookInsight` output
- [x] 3.2 Verify `contextFile` is still passed correctly (no change to that flow)

## 4. Tests

- [x] 4.1 Add unit tests for `buildHookInsight`: correct summary format, truncation at 500 chars, all required tags present
- [x] 4.2 Add unit test: default agentName is `"claude"` when not configured
- [x] 4.3 Add unit test: custom agentName is reflected in `agent:` tag
- [x] 4.4 Add unit test: `run:` tag matches sessionId

## 5. Verification

- [x] 5.1 Run `pnpm lint` and `pnpm test` in `packages/cortex` — all green
- [ ] 5.2 Manual smoke test: start cortex, trigger a tool call, query recall — verify structured tags appear in LTM record metadata
