## 1. Types

- [ ] 1.1 Add `sessionId: string` as required field to `MemoryConfig` in `memory-types.ts`

## 2. Interface

- [ ] 2.1 Add `recallSession(sessionId: string, query: string, options?: Omit<LtmQueryOptions, 'sessionId'>): Promise<LtmQueryResult[]>` to `Memory` interface in `memory.ts`
- [ ] 2.2 Add `recallFull(id: string): Promise<{ record: LtmRecord; episodeSummary: string | null }>` to `Memory` interface

## 3. Implementation

- [ ] 3.1 Implement `recallSession` in `memory-impl.ts`: delegate to `ltm.query(query, { ...options, sessionId })`
- [ ] 3.2 Implement `recallFull` in `memory-impl.ts`: fetch record by ID, return `{ record, episodeSummary: record.episodeSummary ?? null }`; throw `RecordNotFoundError` if not found
- [ ] 3.3 In `memory-factory.ts`, pass `config.sessionId` to `AmygdalaConfig` when constructing the amygdala instance

## 4. Tests

- [ ] 4.1 Unit test: `recallSession` returns only records from the specified session
- [ ] 4.2 Unit test: `recallSession` with additional options (e.g. `tier`) applies both filters
- [ ] 4.3 Unit test: `recallSession` with unknown session returns empty array
- [ ] 4.4 Unit test: `recallFull` returns correct `episodeSummary` for episodic record
- [ ] 4.5 Unit test: `recallFull` returns `null` episodeSummary for semantic record
- [ ] 4.6 Unit test: `recallFull` throws `RecordNotFoundError` for unknown ID
- [ ] 4.7 Unit test: `createMemory` wires `sessionId` to amygdala config
