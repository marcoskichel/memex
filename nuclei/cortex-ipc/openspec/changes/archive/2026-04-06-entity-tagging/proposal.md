## Why

Downstream packages (amygdala, ltm, axon, afferent, dendrite) need a shared `EntityMention` type to pass entity data through the IPC layer without each package defining its own shape.

## What Changes

- Add `EntityMention` interface with `name: string` and `type: EntityType`
- Add `EntityType` union type: `'person' | 'project' | 'concept' | 'preference' | 'decision' | 'tool'`
- Export both from the package root

## Capabilities

### New Capabilities

- `entity-mention`: Shared type definitions for named-entity mentions extracted from memory records

### Modified Capabilities

_(none — no existing specs)_

## Impact

- `nuclei/cortex-ipc/src/index.ts` — new exports
- All packages that import from `@neurome/cortex-ipc` gain access to entity types at zero additional cost
