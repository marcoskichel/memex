# `@neurome/cortex`

Long-lived memory server that hosts all Neurome subsystems (STM, amygdala, hippocampus, LTM) in a single process and exposes them over a Unix domain socket for concurrent client access.

Part of the [Neurome](../../README.md) synapse layer.

## How it works

```
                    /tmp/neurome-{SESSION_ID}.sock
                               |
          +--------------------+--------------------+
          |                    |                    |
     axon client          axon client         axon client
   (claude-hooks)         (dendrite)          (other)

                        cortex process
                    ┌──────────────────┐
                    │  AmygdalaProcess  │
                    │ HippocampusProcess│
                    │   SQLite (STM)    │
                    │   SQLite (LTM)    │
                    └──────────────────┘
```

On startup cortex:

1. Validates env vars — exits with error if required vars are missing
2. Opens SQLite and runs migrations
3. Starts `AmygdalaProcess` and `HippocampusProcess`
4. Probes any existing socket — unlinks it if stale, then binds
5. Writes `cortex ready` to stderr
6. Broadcasts all memory lifecycle events as push messages to every connected client

On `SIGTERM` / `SIGINT`: drains STM, waits for the hippocampus consolidation cycle, then exits 0. Force-exits after 30 s if shutdown stalls.

## Starting the server

```sh
MEMORY_DB_PATH=~/.neurome/memory.db \
ANTHROPIC_API_KEY=sk-ant-... \
npx @neurome/cortex
```

With optional vars:

```sh
MEMORY_DB_PATH=~/.neurome/memory.db \
ANTHROPIC_API_KEY=sk-ant-... \
OPENAI_API_KEY=sk-... \
MEMORY_SESSION_ID=my-project \
npx @neurome/cortex
```

The server writes `cortex ready` to stderr when it is accepting connections.

## Configuration

| Variable            | Required | Description                                                                                                 |
| ------------------- | -------- | ----------------------------------------------------------------------------------------------------------- |
| `MEMORY_DB_PATH`    | yes      | Absolute path to the SQLite database file                                                                   |
| `ANTHROPIC_API_KEY` | yes      | Anthropic API key used by the LLM adapter                                                                   |
| `OPENAI_API_KEY`    | no       | Enables `OpenAIEmbeddingAdapter` for semantic recall                                                        |
| `MEMORY_SESSION_ID` | no       | Session identifier; defaults to a random UUID. Determines the socket path: `/tmp/neurome-{SESSION_ID}.sock` |

## Related

- [`@neurome/axon`](../../synapses/axon) — IPC client for connecting to this socket
- [`@neurome/dendrite`](../../synapses/dendrite) — MCP server that wraps axon
- [`@neurome/afferent`](../../synapses/afferent) — Claude hooks integration
- [`@neurome/memory`](../../nuclei/memory) — core memory facade (STM, amygdala, hippocampus, LTM)

## License

MIT
