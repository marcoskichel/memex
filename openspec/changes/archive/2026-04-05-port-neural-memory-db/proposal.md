## Why

The Neural-Memory-Database prototype exists only as a single Python file with no persistence, no type safety, and no integration with the neurokit monorepo. Porting it to TypeScript as `packages/engram` gives us a first-class, testable, publishable package aligned with the repo's toolchain.

## What Changes

- Create `packages/engram` — a new TypeScript package in the pnpm/Turborepo workspace
- Implement character-level neural text embedding in TypeScript (replacing PyTorch with pure-TS tensor math)
- Implement the associative memory engine: insert, bulk-insert, update, delete, query
- Implement cosine-similarity search and heuristic NL filter extraction
- Expose a typed public API (no HTTP layer — library only, not a service)
- Add unit tests co-located with source

## Capabilities

### New Capabilities

- `neural-embedder`: Character-level feed-forward embedder that converts text to fixed-size float vectors
- `associative-memory`: In-memory record store with embedding-based cosine similarity retrieval and NL filter extraction
- `engram-api`: Public TypeScript API surface (types, factory functions, exported engine class)

### Modified Capabilities

_(none — this is a net-new package)_

## Impact

- New `packages/engram` directory added to the pnpm workspace
- No existing packages modified
- Dependencies: no external ML library required (pure TS math); `vitest` for tests; TypeScript toolchain already present in the repo
