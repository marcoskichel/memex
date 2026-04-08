## 1. Setup

- [x] 1.1 Add `tsx` as a dev dependency in `nuclei/perirhinal/package.json` if not already present
- [x] 1.2 Add `"e2e": "tsx scripts/e2e.ts"` script entry in `package.json`
- [x] 1.3 Create `scripts/` directory and `scripts/e2e.ts` with env-var validation and SQLite setup

## 2. Fixtures and Helpers

- [x] 2.1 Implement `makeRecord(data, entities)` helper that constructs an `Omit<LtmRecord, 'id'>` with the Veridian world defaults
- [x] 2.2 Implement `embedEntity(entity)` using `OpenAIEmbeddingAdapter.embed(entity.name + " (" + entity.type + ")")` and unwrap the result
- [x] 2.3 Implement `printGraphState(storage)` that dumps all nodes, edges, and record links to stdout
- [x] 2.4 Implement `assertNoUnlinked(storage)` that throws with a descriptive message if `getUnlinkedRecordIds()` is non-empty

## 3. Scenarios 1–4 (Baseline)

- [x] 3.1 Scenario 1: Maya + Jordan + Atlas — assert 3 nodes, record linked
- [x] 3.2 Scenario 2: Jordan + Atlas again — assert 0 new nodes, both linked
- [x] 3.3 Scenario 3: Sasha + Atlas + TypeScript — assert 2 new nodes, Atlas reused
- [x] 3.4 Scenario 4: Lena + PostgreSQL + Redis + Cortex — assert 4 new nodes, edges printed

## 4. Scenarios 5–6 (Deduplication Probes)

- [x] 4.1 Scenario 5: "Postgres" (tool) — print cosine vs "PostgreSQL", print resolution decision
- [x] 4.2 Scenario 6a: "RAG" (concept) — inserted fresh
- [x] 4.3 Scenario 6b: "retrieval-augmented generation" (concept) — print cosine vs "RAG", print resolution decision

## 5. Scenarios 7–8 (Edge Cases)

- [x] 5.1 Scenario 7: Jordan + Lena + Cortex + TypeScript — assert 0 new nodes, print new edges
- [x] 5.2 Scenario 8: Dr. Isabel Reyes — assert 1 new node, assert `getEntityNeighbors(drReyes.id, 2)` returns `[]`

## 6. Lock Contention + Final Assertions

- [x] 6.1 Manually acquire lock, run process, assert `result.isErr()` with `type: 'LOCK_FAILED'`
- [x] 6.2 Release lock, run one final pass, assert `getUnlinkedRecordIds()` is empty
- [x] 6.3 Print full graph dump: nodes, edges, deduplication log, depth-2 neighbors of Maya Chen

## 7. Documentation

- [x] 7.1 Create `scripts/e2e.md` documenting prerequisites, env vars, and how to interpret the output
