### Requirement: NEUROME_ACCESS_MODE env var controls tool registration

The dendrite bin SHALL read `NEUROME_ACCESS_MODE` and pass it to `run()`, which passes it to `createServer()`.

#### Scenario: Full access mode

- **WHEN** `NEUROME_ACCESS_MODE=full`
- **THEN** write tools are registered (`log_insight`)

#### Scenario: Read-only access mode

- **WHEN** `NEUROME_ACCESS_MODE=read-only`
- **THEN** no write tools are registered

#### Scenario: Missing env var defaults to read-only

- **WHEN** `NEUROME_ACCESS_MODE` is not set
- **THEN** behavior is identical to `read-only`

#### Scenario: Unrecognized value falls back to read-only

- **WHEN** `NEUROME_ACCESS_MODE` is set to an unrecognized value
- **THEN** behavior is identical to `read-only` (fail-safe)
