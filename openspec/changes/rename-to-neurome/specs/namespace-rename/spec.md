## ADDED Requirements

### Requirement: All packages use @neurome namespace

Every package and synapse in the monorepo SHALL use the `@neurome` npm scope. No package SHALL retain the `@memex` scope after this change is applied.

#### Scenario: Workspace packages resolved under @neurome

- **WHEN** `pnpm install` is run after the rename
- **THEN** all workspace packages resolve as `@neurome/*` with no broken references

### Requirement: IPC socket path uses neurome prefix

The cortex daemon socket path SHALL be `/tmp/neurome-<sessionId>.sock`. No code SHALL reference `/tmp/memex-<sessionId>.sock` after this change.

#### Scenario: Cortex starts with new socket path

- **WHEN** the cortex daemon starts after the rename
- **THEN** it binds to `/tmp/neurome-<sessionId>.sock`

#### Scenario: No remaining memex socket references

- **WHEN** grepping all source files for `memex-` socket path strings
- **THEN** zero matches are found outside of node_modules and git history
