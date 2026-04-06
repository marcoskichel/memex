## Context

The cortex daemon exposes all memory operations over a Unix socket at `/tmp/memex-<sessionId>.sock` using a newline-delimited JSON protocol defined in `@memex/cortex`. Every synapse that needs to talk to cortex has hand-rolled its own socket client. `@memex/axon` extracts this into a single shared, typed, reliable implementation.

## Goals / Non-Goals

**Goals:**

- Single typed async IPC client usable by all synapses
- Persistent socket with reconnect, in-flight request tracking by UUID
- Typed methods for all cortex operations with proper error propagation
- Fire-and-forget mode for write operations that don't need a response

**Non-Goals:**

- Authentication or access control (out of scope for this layer)
- Batching or multiplexing requests
- Streaming responses

## Decisions

**Persistent connection, not per-request**
`claude-hooks` creates a new connection per request. This is wasteful and means each call pays connect latency. `axon` maintains a persistent connection and reconnects on error. Alternative (connection pool) rejected — single connection is sufficient given the local socket latency.

**UUID correlation IDs**
Each request gets a `randomUUID()` ID. Responses are matched by ID. This fixes the `claude-hooks` bug where all requests use `"1"` as the ID (safe only because it was single-request-per-connection).

**Typed method surface, not a generic `request()` call**
Consumers call `axon.recall(query, options)` not `axon.request('recall', { query, options })`. This keeps call sites clean and lets TypeScript catch payload mismatches. Protocol types are sourced from `@memex/cortex`.

**Timeout per call, not per connection**
Each method accepts an optional `timeoutMs`. Defaults match current synapse expectations (50ms for fire-and-forget writes, 200ms for reads). Callers can override. Timeout rejects the promise — does not destroy the connection.

**Fire-and-forget for write operations**
`logInsight`, `insertMemory`, `importText`, `consolidate` are exposed with a `void` return option that does not wait for the response frame. This preserves `afferent`'s non-blocking emit semantics.

## Risks / Trade-offs

**[Risk]** Reconnect logic adds complexity → Mitigation: simple linear backoff, max 3 retries, then the call rejects.

**[Risk]** Persistent connection held open even when idle → Mitigation: `disconnect()` method for explicit teardown; short-lived consumers (hooks) can use a lazy-connect mode.

## Migration Plan

1. `axon` ships as a new package with no breaking changes to existing packages.
2. `afferent` and `claude-hooks` update their deps and switch call sites. Both preserve their public APIs.
3. No rollback needed — packages are independent and the cortex protocol is unchanged.
