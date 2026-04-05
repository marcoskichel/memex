## Context

The project currently uses `neurokit` as its name and `@neurokit/*` as its npm namespace. This conflicts with `neurokit` on PyPI — a well-established Python neuroscience library with thousands of stars — making the name unsuitable for open-source publication. All internal packages, config files, and cross-references must be updated before any public release.

The two in-flight changes (`human-like-agent-memory`, `port-neural-memory-db`) must be merged first to minimize conflict surface.

## Goals / Non-Goals

**Goals:**

- Replace every occurrence of `neurokit` / `@neurokit` with `memex` / `@memex`
- Add `NAME.md` at repo root documenting the name etymology
- Keep all package behavior and APIs identical post-rename

**Non-Goals:**

- Changing package versions, APIs, or public interfaces
- Reorganizing the monorepo structure
- Publishing to npm (out of scope for this change)

## Decisions

### 1. New name: `memex`

Vannevar Bush described the Memex in his 1945 essay _As We May Think_ as a device for extending human memory — a mechanical system that stores, indexes, and retrieves information associatively, mirroring how human memory works. This project is precisely that: an infrastructure layer giving AI agents human-like memory. The name is short (5 chars), memorable, has strong etymological resonance, and is not occupied by any established project in the npm/TypeScript ecosystem.

**Alternatives considered:**

- `mnemos` — Greek root of Mnemosyne; strong meaning but `mn-` cluster causes spelling friction
- `cortex` — occupied by cortex.js (JavaScript testing library)
- `neurite` — accurate neuroscience term but obscure; low search discoverability

### 2. Rename in a single atomic commit per phase

Each phase (config files, source files, docs) gets its own commit rather than one giant rename commit. This keeps git blame useful and makes rollback surgical.

### 3. `NAME.md` at repo root (not inside `docs/`)

Keeps the etymology visible at the top of the repo for contributors browsing GitHub without needing to navigate into subdirectories.

## Risks / Trade-offs

- **In-flight branches with `@neurokit` imports** → Mitigation: enforce merge ordering (existing open changes first); document in PR description
- **grep/search false positives** (e.g., comments mentioning the old name) → Mitigation: manual review pass after automated replacement
- **npm package name squatting** → `@memex/*` scoped packages require an npm org named `memex`; verify org availability before publish (out of scope here, but noted)

## Migration Plan

1. Merge `human-like-agent-memory` and `port-neural-memory-db` first
2. Run automated find-and-replace across all `package.json`, `tsconfig`, config files
3. Run automated find-and-replace across all `.ts` source and test files
4. Rename repo directory / GitHub repo
5. Add `NAME.md`
6. Run full `pnpm install && pnpm build && pnpm test` to verify
7. Commit in phases (config → source → docs)

**Rollback:** Revert commits in reverse order; no data migration involved.
