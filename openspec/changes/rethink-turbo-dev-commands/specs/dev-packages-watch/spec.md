## ADDED Requirements

### Requirement: dev:packages watches all non-cortex packages

The root `dev:packages` script SHALL run `tsc --watch` for all workspace packages except `@neurome/cortex`, using turbo with its TUI enabled.

#### Scenario: Running dev:packages

- **WHEN** the developer runs `pnpm dev:packages`
- **THEN** turbo starts `tsc --watch` for all packages excluding `@neurome/cortex` and displays them in the turbo TUI

#### Scenario: Cortex is excluded

- **WHEN** `pnpm dev:packages` is running
- **THEN** `@neurome/cortex` tsc and node processes are NOT started

### Requirement: dev:cortex watches and runs only cortex

The root `dev:cortex` script SHALL run `tsc --watch` and `node --watch` for `@neurome/cortex` only, using turbo with its TUI.

#### Scenario: Running dev:cortex

- **WHEN** the developer runs `pnpm dev:cortex`
- **THEN** turbo starts cortex `tsc --watch` and `node --watch`, displayed in the turbo TUI

#### Scenario: Package watchers not duplicated

- **WHEN** `pnpm dev:cortex` is running alongside `pnpm dev:packages`
- **THEN** no package (non-cortex) tsc processes are started by `dev:cortex`

### Requirement: dev:tui runs outside turbo

The root `dev:tui` script SHALL run the tui node process directly via pnpm filter, without wrapping it in turbo.

#### Scenario: Running dev:tui

- **WHEN** the developer runs `pnpm dev:tui`
- **THEN** the tui node process starts in the current terminal with full interactive access (no turbo TUI wrapping)

### Requirement: root dev script is removed

The root `dev` script SHALL be removed.

#### Scenario: dev script does not exist

- **WHEN** a developer runs `pnpm dev`
- **THEN** pnpm reports the script does not exist
