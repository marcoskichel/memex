# prototype

## What

Ship the first end-to-end runnable slice of neurokit: a persistent daemon (`@neurokit/cortex`) that owns the memory stack, and a set of Claude Code hook scripts (`synapses/claude-hooks`) that write insights and inject recalled memories — all sharing a single SQLite file with no IPC.

## Why

The two planned specs in `human-like-agent-memory/improvements.md` (Persistent Daemon + Claude Code Hooks Adapter) are unblocked now that `ltm-schema-extensions` and `amygdala-improvements` are merged. The prototype validates the full pipeline: hook fires → insight written to SQLite → daemon reads same DB → amygdala consolidates → hippocampus writes context → next hook reads recalled memories.

Direct SQLite access (no IPC socket) is the simplest correct architecture at this scale. Hook scripts are stateless writers; only the daemon holds long-lived process state (embedding model, amygdala timer).

## Scopes

| Scope          | Path                    | Role                                               |
| -------------- | ----------------------- | -------------------------------------------------- |
| `cortex`       | `packages/cortex`       | Long-lived daemon; owns the full memory stack      |
| `claude-hooks` | `synapses/claude-hooks` | Stateless hook scripts; read/write SQLite directly |

## Shared Contracts

**SQLite file** — single DB at `$MEMORY_DB_PATH`. Both scopes connect with `better-sqlite3`. Schema is owned by `@neurokit/ltm` (LTM tables) and `@neurokit/stm` (insights table, once `sqlite-stm` is merged).

**Context directory** — `$MEMORY_DB_PATH/../context/<session-id>/` (default). `post-tool-use` writes a context file per tool call. `pre-tool-use` reads the latest context file from that directory for injection.

**Environment variables** (shared by both scopes):

| Var                 | Required | Description                                |
| ------------------- | -------- | ------------------------------------------ |
| `MEMORY_DB_PATH`    | yes      | Absolute path to the SQLite file           |
| `ANTHROPIC_API_KEY` | yes      | Key for the Anthropic LLM adapter          |
| `MEMORY_SESSION_ID` | no       | Pin both processes to a fixed session UUID |

## Prerequisites

- `sqlite-stm` change must be merged before implementation — `SqliteInsightLog` is the STM backend used by both scopes.

## Out of Scope

- IPC / Unix socket communication between hooks and daemon
- Multi-daemon coordination
- Any UI or CLI beyond the `cortex` bin entry point
