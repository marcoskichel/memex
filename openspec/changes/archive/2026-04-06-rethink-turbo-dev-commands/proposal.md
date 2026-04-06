## Why

The current `dev` script runs everything (all package watchers + cortex) in a single turbo invocation, making it impossible to run the TUI interactively or develop cortex independently from package libraries. Splitting into focused commands gives each workflow the right environment.

## What Changes

- **BREAKING**: Remove root `dev` script
- Add `dev:packages` — runs `tsc --watch` for all packages except cortex (includes tui), via turbo with TUI
- Update `dev:cortex` — runs cortex `tsc --watch` + `node --watch` only, via turbo with TUI
- Keep `dev:tui` — runs tui node process directly outside turbo (interactive terminal)

## Capabilities

### New Capabilities

- `dev-packages-watch`: Watch-mode compilation for all library packages and tui via turbo, independent of cortex

### Modified Capabilities

- None — no spec-level behavior changes; this is a DX/tooling restructure only

## Impact

- `package.json` root scripts: remove `dev`, add `dev:packages`, update `dev:cortex`
- `turbo.json`: verify existing task definitions support the new script shape (no new tasks expected)
- No production code changes
