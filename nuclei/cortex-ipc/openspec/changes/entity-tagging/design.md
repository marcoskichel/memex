## Context

`@neurome/cortex-ipc` is the shared protocol package. It currently exports message types and socket-path conventions used across axon, afferent, cortex, and dendrite. Adding entity types here makes them available to all packages without creating circular dependencies.

## Goals / Non-Goals

**Goals:**

- Define `EntityMention` and `EntityType` as the canonical shared types
- Export from package root with zero runtime overhead (types only)

**Non-Goals:**

- Entity storage, extraction logic, or deduplication
- Any runtime behavior — this is type definitions only

## Decisions

**Types only, no runtime code.** `EntityMention` and `EntityType` are pure TypeScript interfaces/types. No classes, no validators, no runtime imports. Consumers that need validation (e.g. amygdala's structured LLM output) define their own Zod schemas using these types as the target shape.

**`EntityType` as a string union, not an enum.** Consistent with existing type patterns in the codebase. Easier to extend and serializes naturally to JSON.

## Risks / Trade-offs

- Adding types to `cortex-ipc` means all packages re-build when entity types change. Low risk — type-only changes don't affect runtime.
- If Phase 2 introduces entity graph types, they will also land here. The package will grow but remains cohesive as the protocol contract layer.
