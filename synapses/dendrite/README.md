# `@neurome/dendrite`

MCP server that connects LLM agents to Neurome memory — exposes recall, context assembly, and stats as Model Context Protocol tools so any MCP-compatible agent can query memory without speaking the IPC protocol directly.

Part of the [Neurome](../../README.md) synapse layer.

## How it works

```
LLM agent / MCP host
      |
      | MCP (stdio)
      v
  dendrite
      |
      | IPC (@neurome/axon)
      v
  cortex socket
      |
      v
   memory
```

1. cortex is running and listening on its socket
2. dendrite starts with `MEMEX_SESSION_ID` set, opens an axon connection to cortex
3. the MCP host (e.g. Claude Desktop, Claude Code) spawns dendrite as a stdio server
4. the LLM calls dendrite tools; dendrite forwards requests through axon and returns JSON results

## Usage

Start dendrite alongside a running cortex instance:

```sh
MEMEX_SESSION_ID=my-session npx @neurome/dendrite
```

Wire it as an MCP server in your host config (e.g. `claude_desktop_config.json` or `mcp.json`):

```json
{
  "mcpServers": {
    "dendrite": {
      "command": "npx",
      "args": ["@neurome/dendrite"],
      "env": {
        "MEMEX_SESSION_ID": "my-session"
      }
    }
  }
}
```

## Tools

| Tool          | Description                                                                                                                                                             |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `recall`      | Semantic search over memory. Accepts a natural language `query` and optional `options` object. Returns `RecallResult[]`.                                                |
| `get_recent`  | Returns the N most recently stored records. Requires a `limit` integer.                                                                                                 |
| `get_context` | Assembles pre-ranked context for a tool call. Accepts `tool_name`, `tool_input`, and optional `category`; applies session and category boosting, returns top-5 results. |
| `get_stats`   | Returns current memory system statistics (record counts, index state, etc.).                                                                                            |

All tools return a single text content block containing a JSON-serialised result. Errors are returned as MCP error content (`isError: true`) rather than thrown exceptions.

## Configuration

| Variable           | Required | Description                                                                       |
| ------------------ | -------- | --------------------------------------------------------------------------------- |
| `MEMEX_SESSION_ID` | yes      | The cortex session ID to connect to. Dendrite exits immediately if this is unset. |

## Related

- [`@neurome/cortex`](../cortex/README.md) — the memory process that dendrite connects to
- [`@neurome/axon`](../axon/README.md) — IPC client used internally to communicate with cortex

## License

MIT
