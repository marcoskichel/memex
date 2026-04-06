## 1. Interface + Implementation

- [x] 1.1 Add `insertMemory(data: string, options?: LtmInsertOptions): Promise<number>` to `Memory` interface in `src/memory-types.ts`
- [x] 1.2 Add `importText(text: string): Promise<{ inserted: number }>` to `Memory` interface in `src/memory-types.ts`
- [x] 1.3 Add `getRecent(limit: number): Promise<LtmRecord[]>` to `Memory` interface in `src/memory-types.ts`
- [x] 1.4 Implement `insertMemory` in `src/memory-impl.ts` — calls `ltm.insert(data, options)`, returns record id
- [x] 1.5 Implement `importText` in `src/memory-impl.ts` — calls LLM adapter to extract discrete memory strings from text, bulk-inserts each via `ltm.insert()`, returns `{ inserted: count }`
- [x] 1.6 Implement `getRecent` in `src/memory-impl.ts` — queries storage adapter `ORDER BY created_at DESC LIMIT ?`
- [x] 1.7 Add unit tests: `insertMemory` returns numeric id and inserts with correct options; `importText` calls LLM adapter and returns `{ inserted: N }` (mock LLM); `getRecent` returns records sorted by creation date desc and respects limit
