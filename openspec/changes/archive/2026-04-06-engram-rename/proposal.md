# engram-rename

## Why

"Session" is borrowed from web/auth contexts (HTTP sessions, user sessions) and implies something temporary and user-facing. The actual concept — an agent's isolated memory context for a task run, backed by its own forked database — maps precisely to an "engram": the neuroscience term for the physical trace a memory leaves in the brain. This aligns with the project's naming system (`cortex`, `axon`, `dendrite`, `hippocampus`, `amygdala`) and accurately describes what the construct represents.

## What Changes

Pure identifier rename — no logic changes.

- `sessionId` → `engramId` in all parameter names, type fields, and variable names
- `MEMEX_SESSION_ID` env var → `NEUROME_ENGRAM_ID`
- `IPC_SOCKET_PATH(sessionId)` → `IPC_SOCKET_PATH(engramId)` — socket path format `/tmp/neurome-<id>.sock` unchanged
- `MemoryConfig.sessionId` → `MemoryConfig.engramId`
- `MemoryImpl.sessionId` → `MemoryImpl.engramId`

## Affected Packages

- `nuclei/cortex-ipc` — protocol types, `IPC_SOCKET_PATH`
- `nuclei/axon` — `AxonClient` constructor, internal references
- `nuclei/memory` — `MemoryConfig`, `MemoryImpl`, `memory-factory`
- `nuclei/stm` — context manager
- `nuclei/amygdala` — `AmygdalaProcess` constructor
- `nuclei/hippocampus` — process and test files
- `synapses/cortex` — binary, IPC handlers, env var
- `synapses/dendrite` — binary, server
- `synapses/afferent` — index
- `synapses/neurome-tui` — socket client and binary

## Impact

- **BREAKING** for any external consumer — all `sessionId` fields and env var rename
- No runtime behavior changes
- Socket path format unchanged
