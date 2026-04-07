## Context

`@neurome/claude-hooks` provided two CLI executables (`pre-tool-use`, `post-tool-use`) for Claude Code hook integration via `@neurome/axon`. The package is entirely unused in the monorepo and the hook integration is no longer needed.

## Goals / Non-Goals

**Goals:**

- Delete the `synapses/claude-hooks` directory entirely
- Run `pnpm install` to remove it from the lockfile

**Non-Goals:**

- Replacing the hooks with any alternative integration
- Modifying `@neurome/axon` (it has other consumers)

## Decisions

**Delete the directory rather than emptying it.** The package is not published and has zero consumers — there is no migration path needed. Removing the directory is the cleanest outcome.

## Risks / Trade-offs

- [Anyone using the `pre-tool-use`/`post-tool-use` binaries via Claude Code `.claude/settings.json`] → No known external consumers; risk is negligible
