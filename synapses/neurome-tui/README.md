# `@neurome/neurome-tui`

Terminal dashboard connecting an operator to a running cortex instance — real-time memory events, live statistics, and an interactive query REPL.

Part of the [Neurome](../../README.md) synapse layer.

## Setup / How it works

The TUI connects to a cortex session over IPC and renders a three-pane layout built with React + Ink:

- **Events pane** — real-time stream of memory events pushed by cortex (amygdala scoring, hippocampus consolidation, etc.). Capped at 200 events.
- **Stats pane** — live LTM record counts (episodic/semantic), STM backlog size, and retention averages. Polls cortex on focus.
- **Query REPL** — interactive text input for inspecting memory. Type a query and press Enter to recall matching records; navigate results with arrow keys and Enter to drill into a record.

Navigate between panes with `Tab`. Press `:` (outside the REPL) to open the command palette, which supports:

| Command         | Description                                                |
| --------------- | ---------------------------------------------------------- |
| `add`           | Open a form to insert a new memory record                  |
| `consolidate`   | Trigger STM → LTM consolidation on the cortex instance     |
| `import <path>` | Parse a markdown file and preview records before importing |
| `reset`         | Reset the IPC connection                                   |

Press `r` to reset the connection or `q` to quit (both outside the REPL).

If cortex disconnects, the TUI auto-reconnects up to 10 times with a 2-second delay between attempts.

### Import file format

The `import` command accepts structured markdown files delimited by `---`. Each record is a frontmatter block followed by content:

```
---
tier: episodic
category: meetings
importance: 0.8
tags: [planning, q2]
---
Discussed roadmap priorities for Q2. Key outcome: ship memory consolidation by end of month.
```

Files without `---` delimiters are imported as plain text via cortex's `importText` handler.

## Usage

```sh
MEMORY_SESSION_ID=my-session npx @neurome/neurome-tui
```

## Configuration

| Variable            | Required | Description                     |
| ------------------- | -------- | ------------------------------- |
| `MEMORY_SESSION_ID` | yes      | Cortex session ID to connect to |

## Related

- [`@neurome/cortex`](../cortex/README.md) — the cortex memory engine this TUI connects to
- [`@neurome/cortex-ipc`](../cortex-ipc/README.md) — IPC protocol and socket path used for communication

## License

MIT
