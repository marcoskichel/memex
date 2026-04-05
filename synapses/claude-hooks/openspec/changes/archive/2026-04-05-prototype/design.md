## Context

Claude Code hook scripts are configured in `.claude/settings.json` under `hooks`. Each hook type maps to a command. Claude Code runs the command as a child process, passes a JSON payload on stdin, and (for `PreToolUse`) reads stdout to inject additional context into the system prompt.

Hook scripts are stateless — each invocation is a fresh process. They must complete quickly. No daemon connection, no warm cache. The only shared state is the SQLite file.

`@neurokit/stm` (after `sqlite-stm` merge) exports `SqliteInsightLog` — open DB, insert row, close. Synchronous, zero async overhead. This is the right write path for hooks.

`@neurokit/ltm` exports `SqliteAdapter` which can read context files persisted by `HippocampusProcess`. Hooks use this for the pre-tool-use read path.

## Goals / Non-Goals

**Goals:**

- `post-tool-use`: Write one insight row + one context file per invocation
- `pre-tool-use`: Read context files, output formatted memories to stdout
- Both scripts share env var config with the cortex daemon
- Tests cover the payload parsing and SQLite write/read paths

**Non-Goals:**

- Subscribing to the cortex daemon socket
- Handling `PostSessionEnd` in this change (deferred)
- Rate limiting or deduplication of insights
- Support for hook types other than `PostToolUse` and `PreToolUse`

## Decisions

### D1: Direct SQLite, no IPC

Hook scripts connect to `MEMORY_DB_PATH` directly using `SqliteInsightLog` and `SqliteAdapter`. No daemon connection needed for the write path. This means insights are durably persisted even when the daemon is not running.

### D2: Context files as the recall mechanism for `pre-tool-use`

Rather than querying the LTM embedding index (which requires a warm embedding model), `pre-tool-use` reads the markdown context files written by `HippocampusProcess`. These are pre-formatted for injection. This keeps the pre-tool-use script dependency-light and fast.

**Fallback:** if no context directory or no files exist, output nothing. Claude Code treats empty stdout as "no additional context".

### D3: Hook payload schema validated with Zod

Claude Code hook payloads are typed but validated defensively. If `stdin` fails to parse or required fields are missing, log to stderr and exit 0 (not 1 — a failing hook blocks tool use, which is disruptive).

### D4: Session ID from env var

Both hooks read `MEMORY_SESSION_ID` from the environment (same var as the daemon). This pins the hooks and daemon to the same session. If unset, `post-tool-use` generates a new UUID per process — acceptable but non-ideal.

### D5: Context file path convention

Context files written by `HippocampusProcess` live at `$MEMORY_DB_PATH/../context/<session-id>/`. `pre-tool-use` reads the three most recent files by mtime and concatenates them. Content is passed as-is to stdout.

## File Layout

```
synapses/claude-hooks/
  package.json          # private, no name needed for npm; bin entries for both hooks
  tsconfig.json
  src/
    bin/
      post-tool-use.ts  # entry: read stdin, write insight + context file
      pre-tool-use.ts   # entry: read context files, write to stdout
    core/
      parse-hook-payload.ts   # pure: parse + validate stdin JSON
      format-context.ts       # pure: format context files for injection
    shell/
      clients/
        insight-writer.ts     # I/O: open SqliteInsightLog, append, close
        context-reader.ts     # I/O: read context files from disk
        context-file-writer.ts # I/O: write context file to session dir
    __tests__/
      parse-hook-payload.test.ts
      format-context.test.ts
      insight-writer.test.ts
      context-reader.test.ts
```

## Hook Payload Shape (Claude Code PostToolUse)

```typescript
interface PostToolUsePayload {
  session_id: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_response: unknown;
}
```

`pre-tool-use` receives the same shape minus `tool_response`.

## Function Structure

### `post-tool-use.ts`

```
main()
  - read stdin to string
  - call parseHookPayload(stdin) → on err: log stderr, exit 0
  - call appendInsight({ dbPath, sessionId, payload })
  - call writeContextFile({ contextDir, sessionId, payload })
  - exit 0
```

### `pre-tool-use.ts`

```
main()
  - read MEMORY_DB_PATH, MEMORY_SESSION_ID from env
  - call readContextFiles({ contextDir, sessionId, limit: 3 })
  - call formatContext(files) → string
  - write to stdout
  - exit 0
```

### `parseHookPayload(raw: string)` (core)

```
- fromThrowable(JSON.parse)(raw)
- validate shape with Zod schema
- return Result<HookPayload, ParseError>
```

### `appendInsight(opts)` (shell)

```
- construct SqliteInsightLog(opts.dbPath)
- build InsightEntry from payload (summary = tool_name + truncated tool_response)
- call log.append(entry)
```

### `readContextFiles(opts)` (shell)

```
- read dir at contextDir/sessionId
- sort files by mtime descending
- take first opts.limit files
- read each file content
- return string[]
```

## Risks / Trade-offs

- **Hook blocks tool use on exit code 1** — all error paths exit 0, log to stderr. Insight loss is acceptable; blocking the user is not.
- **Context files may not exist on first run** — `pre-tool-use` outputs nothing. Claude Code proceeds normally.
- **Truncated tool responses** — insight summaries truncate `tool_response` to 500 chars to keep the insights table row size manageable.

## Open Questions

_(none — all decisions made)_
