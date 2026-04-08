import type { LLMAdapter, LLMError } from '@neurome/llm';
import { errAsync, ResultAsync } from 'neverthrow';
import { describe, expect, it, vi } from 'vitest';

import type { DeduplicationCandidate } from '../shell/clients/extraction-client.js';
import { callDeduplicationLlm, callExtractionLlm } from '../shell/clients/extraction-client.js';

function makeMockLlm(response: unknown): LLMAdapter {
  return {
    complete: vi.fn(),
    completeStructured: vi
      .fn()
      .mockReturnValue(ResultAsync.fromSafePromise(Promise.resolve(response))),
  };
}

function makeMockLlmError(error: LLMError): LLMAdapter {
  return {
    complete: vi.fn(),
    completeStructured: vi.fn().mockReturnValue(errAsync(error)),
  };
}

describe('callExtractionLlm', () => {
  it('maps LLM response to entities and edges', async () => {
    const llm = makeMockLlm({
      entities: [{ name: 'Alice', type: 'person' }],
      edges: [{ fromName: 'Alice', toName: 'Neurome', relationshipType: 'works_at' }],
    });

    const result = await callExtractionLlm(llm, 'test prompt');
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.entities[0]?.name).toBe('Alice');
      expect(result.value.edges[0]?.relationshipType).toBe('works_at');
    }
  });

  it('maps LLM error to LLM_CALL_FAILED', async () => {
    const llmError: LLMError = { type: 'NO_CONTENT' };
    const llm = makeMockLlmError(llmError);

    const result = await callExtractionLlm(llm, 'test prompt');
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe('LLM_CALL_FAILED');
    }
  });
});

describe('callDeduplicationLlm', () => {
  it('returns merge decision when LLM confirms same entity', async () => {
    const llm = makeMockLlm({
      results: [{ index: 0, decision: 'merge', candidateId: 42 }],
    });

    const candidates: DeduplicationCandidate[] = [
      {
        extractedIndex: 0,
        extracted: { name: 'alice', type: 'person', embedding: new Float32Array([1, 0, 0]) },
        candidateId: 42,
        candidateName: 'Alice',
      },
    ];

    const result = await callDeduplicationLlm(llm, candidates);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.get(0)).toBe('merge');
    }
  });

  it('returns distinct decision when LLM confirms different entity', async () => {
    const llm = makeMockLlm({
      results: [{ index: 0, decision: 'distinct', candidateId: 5 }],
    });

    const candidates: DeduplicationCandidate[] = [
      {
        extractedIndex: 0,
        extracted: { name: 'ali', type: 'person', embedding: new Float32Array([1, 0, 0]) },
        candidateId: 5,
        candidateName: 'Alicia',
      },
    ];

    const result = await callDeduplicationLlm(llm, candidates);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.get(0)).toBe('distinct');
    }
  });
});
