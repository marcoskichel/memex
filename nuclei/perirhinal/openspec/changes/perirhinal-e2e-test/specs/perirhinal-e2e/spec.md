## ADDED Requirements

### Requirement: E2E script runs the full extraction pipeline against real services

A script at `scripts/e2e.ts` SHALL exercise `EntityExtractionProcess` end-to-end using a real Anthropic LLM adapter, a real OpenAI embedding adapter, and a `SqliteAdapter` backed by a fresh temporary database. The script SHALL be executable via `pnpm tsx scripts/e2e.ts` and SHALL require `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` environment variables.

#### Scenario: Script runs to completion without uncaught errors

- **WHEN** `pnpm tsx scripts/e2e.ts` is run with valid API keys
- **THEN** the script exits with code 0 and prints a final graph dump

#### Scenario: Missing API key produces a clear error

- **WHEN** `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` is not set
- **THEN** the script exits with code 1 and prints a descriptive message before making any API calls

### Requirement: E2E script covers eight realistic scenarios in sequence

The script SHALL run eight scenarios against a shared SQLite database, each inserting one LTM record and running `EntityExtractionProcess`. Scenarios SHALL be drawn from a consistent fictional world (Veridian startup) and SHALL collectively exercise all four entity resolution paths: exact, merge, llm-needed, and distinct.

#### Scenario: Scenario 1 — baseline insertion

- **WHEN** a record about Maya Chen and Jordan Park discussing Atlas is processed
- **THEN** at least two entity nodes exist and the record has no unlinked ids

#### Scenario: Scenario 2 — exact deduplication

- **WHEN** a second record mentioning Jordan Park and Atlas is processed
- **THEN** no new nodes are created for Jordan Park or Atlas

#### Scenario: Scenario 3 — partial deduplication

- **WHEN** a record mentioning Atlas (existing) and Sasha Novak (new) is processed
- **THEN** exactly one new node is created for Sasha Novak; Atlas is reused

#### Scenario: Scenario 4 — multi-entity multi-edge

- **WHEN** a record mentioning Lena Müller, PostgreSQL, Redis, and Cortex is processed
- **THEN** four new nodes exist and edges are created between entities as extracted by the LLM

#### Scenario: Scenario 5 — Postgres deduplication probe

- **WHEN** a record mentioning "Postgres" (tool) is processed after "PostgreSQL" (tool) already exists
- **THEN** the script prints the cosine similarity and the resolution decision (exact/merge/llm-needed/distinct)

#### Scenario: Scenario 6 — RAG abbreviation probe

- **WHEN** a record mentioning "RAG" (concept) is followed by a record mentioning "retrieval-augmented generation" (concept)
- **THEN** the script prints the cosine similarity and the resolution decision for the second entity

#### Scenario: Scenario 7 — edges-only run

- **WHEN** a record mentioning only already-known entities is processed
- **THEN** no new nodes are created; new edges are created as extracted

#### Scenario: Scenario 8 — isolated new node

- **WHEN** a record mentioning only Dr. Isabel Reyes (not previously seen) is processed
- **THEN** one new node is created with no outgoing edges

### Requirement: E2E script asserts structural invariants and prints a final graph dump

After all eight scenarios, the script SHALL assert that no records remain in `getUnlinkedRecordIds()` and SHALL print a structured summary: all entity nodes with id/name/type, all edges with fromName/toName/type, a deduplication log showing resolution decisions and cosine similarities for the probe scenarios, and the neighbor set of a selected node at depth 2.

#### Scenario: Final unlinked count is zero

- **WHEN** all eight scenarios have completed
- **THEN** `storage.getUnlinkedRecordIds()` returns an empty array

#### Scenario: Graph dump includes all nodes and edges

- **WHEN** the script prints the final graph dump
- **THEN** every entity node inserted across all scenarios appears in the dump with its name and type

#### Scenario: Lock contention is observable

- **WHEN** the script manually acquires the lock and then calls `process.run()`
- **THEN** the result is `Err({ type: 'LOCK_FAILED' })` and the script prints a confirmation

### Requirement: embedEntity function uses name and type as the embedded text

The `embedEntity` function passed to `EntityExtractionProcess` SHALL embed the string `"{name} ({type})"` — e.g. `"PostgreSQL (tool)"` — using `OpenAIEmbeddingAdapter.embed()`. This convention SHALL be documented in `scripts/e2e.md`.

#### Scenario: Embedding text includes type suffix

- **WHEN** `embedEntity({ name: 'PostgreSQL', type: 'tool', embedding: ... })` is called
- **THEN** the string passed to `EmbeddingAdapter.embed` is `"PostgreSQL (tool)"`
