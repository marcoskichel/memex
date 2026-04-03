## ADDED Requirements

### Requirement: Typed public exports
The package SHALL export all public types, the `EngramEngine` class, and a `createEngramEngine` factory function from its root entry point.

#### Scenario: Named imports work
- **WHEN** a consumer does `import { EngramEngine, createEngramEngine } from '@neurokit/engram'`
- **THEN** both are available and correctly typed

### Requirement: EngramRecord type
The package SHALL export an `EngramRecord` type containing `id: number`, `data: string`, `metadata: Record<string, unknown>`, and `similarity?: number`.

#### Scenario: Query result conforms to EngramRecord
- **WHEN** `engine.query(...)` returns results
- **THEN** each result satisfies the `EngramRecord` interface

### Requirement: Factory function
The package SHALL export `createEngramEngine(options?)` that returns a ready-to-use `EngramEngine` instance. All options SHALL have defaults.

#### Scenario: Factory with defaults
- **WHEN** `createEngramEngine()` is called with no arguments
- **THEN** a functional engine is returned without error

### Requirement: Package metadata
The package SHALL have name `@neurokit/engram`, a `main` and `types` field pointing to compiled output, and declare no runtime dependencies.

#### Scenario: Zero runtime dependencies
- **WHEN** the package.json `dependencies` field is inspected
- **THEN** it is empty or absent
