# sdk-expose-consolidate

## What

Expose `consolidate(target?)` on the `Engram` SDK class so consumers can programmatically trigger a memory processing round. Extend the existing `consolidate` command (already present in IPC, `AxonClient`, and `Memory`) with an optional `target` parameter to control which processes run.

## Why

`consolidate` already exists end-to-end — on `Memory`, `AxonClient`, the IPC protocol, and the cortex handler — but stops at the SDK boundary. The `Engram` class never wired it up. Consumers have no way to force STM to flush or trigger semantic consolidation on demand (e.g. at session close, after a bulk `logInsight` burst, or in tests).

## Target parameter

```
'amygdala'    — drain STM into LTM (also triggers perirhinal entity extraction)
'hippocampus' — consolidate accumulated episodics into semantics
'all'         — run both in sequence (default, matches current behavior)
```

## Scopes

- **cortex-ipc** — extend `ConsolidatePayload` with optional `target` field
- **memory** — extend `Memory.consolidate()` signature and `MemoryImpl` to route by target
- **axon** — extend `AxonClient.consolidate()` to accept and forward target
- **cortex** — pass target from payload through to `memory.consolidate()`
- **sdk** — add `consolidate(target?)` to `Axon` interface and `Engram` class; export `ConsolidateTarget` type
