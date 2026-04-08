# sdk-expose-consolidate — sdk

## What

Wire `consolidate(target?)` into the `Engram` class and export the `ConsolidateTarget` type.

## Changes

- `engram.ts`: add `consolidate(target?: ConsolidateTarget): Promise<void>` to `Axon` interface and `Engram` class, delegating to `axon.consolidate(target)`
- `types.ts`: export `ConsolidateTarget = 'amygdala' | 'hippocampus' | 'all'`
- `index.ts`: re-export `ConsolidateTarget` from the package
