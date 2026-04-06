## 1. Add Dependency

- [ ] 1.1 Add `@memex/axon` to `synapses/afferent/package.json` dependencies

## 2. Migrate Transport

- [ ] 2.1 In `src/index.ts`, replace internal `net.Socket` and queue logic with an `AxonClient` instance and a local pre-connect queue array
- [ ] 2.2 On `emit`: if axon is connected, call `axon.logInsight(frame)` fire-and-forget; otherwise push to pre-connect queue (cap at 1000)
- [ ] 2.3 On axon connect, drain the pre-connect queue via fire-and-forget `logInsight` calls
- [ ] 2.4 On `disconnect`: call `axon.disconnect()`, clear the queue
- [ ] 2.5 Remove all `node:net` imports and socket management code

## 3. Verify and Test

- [ ] 3.1 Confirm public API (`createAfferent`, `Afferent` interface) is unchanged
- [ ] 3.2 Update/add unit tests covering: queue drains on connect, queue cap at 1000, disconnect clears queue
- [ ] 3.3 Run `pnpm check` in `synapses/afferent`, fix any lint/type errors
