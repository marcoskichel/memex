import type { LLMAdapter } from '@neurome/llm';
import type { LtmRecord } from '@neurome/ltm';
import { InMemoryAdapter } from '@neurome/ltm';
import { ResultAsync } from 'neverthrow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ExtractedEntity } from '../core/types.js';
import { EntityExtractionProcess } from '../shell/entity-extraction-process.js';

function makeRecord(overrides: Partial<LtmRecord> = {}): Omit<LtmRecord, 'id'> {
  return {
    data: overrides.data ?? 'Alice works at Neurome.',
    metadata: overrides.metadata ?? {
      entities: [{ name: 'Alice', type: 'person' }],
    },
    embedding: new Float32Array([1, 0, 0]),
    embeddingMeta: { modelId: 'test', dimensions: 3 },
    tier: 'episodic',
    importance: 0.5,
    stability: 1,
    lastAccessedAt: new Date(),
    accessCount: 0,
    createdAt: new Date(),
    tombstoned: false,
    tombstonedAt: undefined,
    engramId: 'test-engram',
    ...overrides,
  };
}

function makeAliceEmbedding(): Float32Array {
  return new Float32Array([1, 0, 0]);
}

function makeMockLlm(entities: { name: string; type: string }[], edges = []): LLMAdapter {
  return {
    complete: vi.fn(),
    completeStructured: vi
      .fn()
      .mockReturnValue(ResultAsync.fromSafePromise(Promise.resolve({ entities, edges }))),
  };
}

function embedAlice(_entity: ExtractedEntity): Promise<Float32Array> {
  return Promise.resolve(makeAliceEmbedding());
}

describe('EntityExtractionProcess integration', () => {
  let storage: InMemoryAdapter;

  beforeEach(() => {
    storage = new InMemoryAdapter();
  });

  it('8.1 full run: record with entities produces node + link', async () => {
    const recordId = storage.insertRecord(makeRecord());
    const llm = makeMockLlm([{ name: 'Alice', type: 'person' }]);
    const process = new EntityExtractionProcess({ storage, llm, embedEntity: embedAlice });

    const result = await process.run();
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.recordsProcessed).toBe(1);
      expect(result.value.entitiesInserted).toBeGreaterThanOrEqual(1);
      expect(result.value.errors).toBe(0);
    }

    const unlinkedAfter = storage.getUnlinkedRecordIds();
    expect(unlinkedAfter).not.toContain(recordId);
  });

  it('3.2 run with no unlinked records returns all-zero stats', async () => {
    const llm = makeMockLlm([]);
    const process = new EntityExtractionProcess({ storage, llm, embedEntity: embedAlice });

    const result = await process.run();
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual({
        recordsProcessed: 0,
        entitiesInserted: 0,
        entitiesReused: 0,
        errors: 0,
      });
    }
  });

  it('3.3 run with one new entity and one reused entity returns correct counts', async () => {
    const aliceEmbedding = makeAliceEmbedding();
    storage.insertEntity({
      name: 'alice',
      type: 'person',
      embedding: aliceEmbedding,
      createdAt: new Date(),
    });

    storage.insertRecord(
      makeRecord({
        metadata: {
          entities: [
            { name: 'Alice', type: 'person' },
            { name: 'Bob', type: 'person' },
          ],
        },
      }),
    );

    function embedBoth(entity: ExtractedEntity): Promise<Float32Array> {
      if (entity.name === 'Alice') {
        return Promise.resolve(aliceEmbedding);
      }
      return Promise.resolve(new Float32Array([0, 1, 0]));
    }

    const llm = makeMockLlm([
      { name: 'Alice', type: 'person' },
      { name: 'Bob', type: 'person' },
    ]);
    const process = new EntityExtractionProcess({ storage, llm, embedEntity: embedBoth });

    const result = await process.run();
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.recordsProcessed).toBe(1);
      expect(result.value.entitiesInserted).toBe(1);
      expect(result.value.entitiesReused).toBe(1);
      expect(result.value.errors).toBe(0);
    }
  });

  it('8.1 second run is idempotent — no duplicate nodes', async () => {
    storage.insertRecord(makeRecord());
    const llm = makeMockLlm([{ name: 'Alice', type: 'person' }]);
    const process = new EntityExtractionProcess({ storage, llm, embedEntity: embedAlice });

    await process.run();
    storage.releaseLock('entity-extraction');
    await process.run();

    const allRecords = storage.getAllRecords();
    const unlinked = storage.getUnlinkedRecordIds();
    expect(unlinked).toHaveLength(0);
    expect(allRecords).toHaveLength(1);
  });

  it('8.2 deduplication: two records referencing same entity produces one node and two links', async () => {
    const record1Id = storage.insertRecord(makeRecord({ data: 'Alice is here.' }));
    const record2Id = storage.insertRecord(makeRecord({ data: 'Alice is there.' }));

    const llm = makeMockLlm([{ name: 'Alice', type: 'person' }]);
    const firstProcess = new EntityExtractionProcess({
      storage,
      llm,
      embedEntity: embedAlice,
    });

    await firstProcess.run();
    storage.releaseLock('entity-extraction');

    const secondProcess = new EntityExtractionProcess({
      storage,
      llm,
      embedEntity: embedAlice,
    });
    await secondProcess.run();

    const unlinked = storage.getUnlinkedRecordIds();
    expect(unlinked).not.toContain(record1Id);
    expect(unlinked).not.toContain(record2Id);
  });

  it('8.3 lock contention: second instance exits without processing', async () => {
    storage.insertRecord(makeRecord());
    const llm = makeMockLlm([{ name: 'Alice', type: 'person' }]);

    const secondProcess = new EntityExtractionProcess({ storage, llm, embedEntity: embedAlice });

    storage.acquireLock('entity-extraction', 60_000);

    const result = await secondProcess.run();
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe('LOCK_FAILED');
    }
  });
});
