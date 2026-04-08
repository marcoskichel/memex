## Why

`@neurome/sdk` is the public API surface that end users call — `startEngram()` spawns a cortex child process, waits for it to signal readiness, connects via IPC, and returns an `Engram` handle. None of this process lifecycle is validated by any existing test. Bugs in cortex binary startup, IPC socket wiring, `connectWithRetry`, `forkDatabase`, or `Engram.close()` would only surface in production.

All other e2e tests (ltm, memory, amygdala, hippocampus, perirhinal) exercise in-process library code. The SDK e2e is the only test that validates the binary/process/IPC tier — the actual path a user takes.

## What Changes

- Add `scripts/e2e.ts`: a narrow e2e script exercising `startEngram()` through `Engram.close()` against real APIs
- Add `"e2e"` npm script to `package.json` using `dotenv-cli` + `tsx`
- Add `.env.e2e` (gitignored) for `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`
- Add `dotenv-cli` to `devDependencies` (tsx is already a root dep)

## Capabilities

### New Capabilities

- `sdk-e2e`: End-to-end test script validating the full SDK process lifecycle and IPC wiring against real services

### Modified Capabilities

## Impact

- `synapses/sdk/scripts/e2e.ts` — new file
- `synapses/sdk/package.json` — new `e2e` script + devDeps
- No changes to production source code
