# Design: Agent Profile Threading in Memory Layer

## Approach

The implementation mirrors the existing `agentState` pattern exactly. This ensures consistency and leverages proven patterns within the codebase.

## Rationale

`agentState` is already successfully threaded through memory to amygdala at two points:

1. **MemoryConfig acceptance** (memory-types.ts:54):

   ```typescript
   agentState?: AgentState;
   ```

2. **Conditional spread in buildAmygdala** (memory-factory.ts:35):
   ```typescript
   ...(config.agentState !== undefined && { agentState: config.agentState }),
   ```

This same pattern is battle-tested and idiomatic to the codebase.

## Implementation

Follow the exact pattern:

1. Add `agentProfile?` to `MemoryConfig` interface in memory-types.ts
2. Add conditional spread in `buildAmygdala` using the same check pattern:
   ```typescript
   ...(config.agentProfile !== undefined && { agentProfile: config.agentProfile }),
   ```

## Design Benefits

- **Consistency**: Identical pattern to agentState threading
- **Type Safety**: Optional fields prevent undefined bugs
- **Backward Compatibility**: Absent properties don't affect AmygdalaProcess
- **Maintainability**: Future developers see the same pattern twice and understand the convention
