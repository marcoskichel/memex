## 1. Add Dependency

- [ ] 1.1 Add `@memex/axon` to `synapses/claude-hooks/package.json` dependencies

## 2. Replace getContext

- [ ] 2.1 In `src/bin/pre-tool-use.ts`, replace `getContext` import from `cortex-socket-client` with an `AxonClient` instantiated from the resolved session ID
- [ ] 2.2 Call `axon.getContext(payload, { timeoutMs: 200 })` inside a try/catch that exits 0 on any error
- [ ] 2.3 On success, write the returned string to stdout

## 3. Replace sendLogInsight

- [ ] 3.1 In `src/bin/post-tool-use.ts`, replace `sendLogInsight` import from `cortex-socket-client` with an `AxonClient`
- [ ] 3.2 Call `axon.logInsight(payload, { timeoutMs: 50 })` fire-and-forget inside a try/catch that exits 0 on any error

## 4. Delete Old Client

- [ ] 4.1 Delete `src/shell/clients/cortex-socket-client.ts`
- [ ] 4.2 Delete `src/__tests__/cortex-socket-client.test.ts`

## 5. Verify and Test

- [ ] 5.1 Add tests for `pre-tool-use` and `post-tool-use` covering: timeout → exit 0, no session ID → exit 0, successful call
- [ ] 5.2 Run `pnpm check` in `synapses/claude-hooks`, fix any lint/type errors
