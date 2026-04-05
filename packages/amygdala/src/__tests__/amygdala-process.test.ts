import type { LLMAdapter } from '@neurokit/llm';
import type { LtmEngine } from '@neurokit/ltm';
import type { InsightEntry, InsightLog } from '@neurokit/stm';
import { errAsync, okAsync } from 'neverthrow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { EventBus } from '../amygdala-process.js';
import { AmygdalaProcess } from '../amygdala-process.js';
import { applyAction } from '../apply-action.js';

const TEST_SESSION_ID = 'test-session-42';

function makeEntry(overrides: Partial<InsightEntry> = {}): InsightEntry {
  return {
    id: crypto.randomUUID(),
    summary: 'Test observation',
    contextFile: '/tmp/test-context.txt',
    tags: [],
    timestamp: new Date(),
    processed: false,
    ...overrides,
  };
}

const okResult = (value: unknown) => ({ isOk: () => true, isErr: () => false, value: value });

function makeLtm(overrides: Record<string, unknown> = {}): LtmEngine {
  return {
    insert: vi.fn().mockResolvedValue(42),
    relate: vi.fn().mockReturnValue(1),
    query: vi.fn().mockReturnValue(okResult([])),
    storage: {
      acquireLock: vi.fn().mockReturnValue(true),
      releaseLock: vi.fn(),
    },
    ...overrides,
  } as unknown as LtmEngine;
}

function makeStm(entries: InsightEntry[] = []): InsightLog {
  const log = {
    readUnprocessed: vi.fn().mockReturnValue(entries),
    markProcessed: vi.fn(),
    append: vi.fn(),
    clear: vi.fn(),
  } as unknown as InsightLog;
  return log;
}

const DEFAULT_LLM_RESULT = {
  action: 'insert',
  importanceScore: 0.5,
  reasoning: 'test',
};

function makeLlmAdapter(result: unknown = DEFAULT_LLM_RESULT): LLMAdapter {
  return {
    complete: vi.fn(),
    completeStructured: vi.fn().mockReturnValue(okAsync(result)),
  } as unknown as LLMAdapter;
}

function makeEventBus(): EventBus & {
  listeners: Map<string, ((...arguments_: unknown[]) => void)[]>;
} {
  const listeners = new Map<string, ((...arguments_: unknown[]) => void)[]>();
  return {
    listeners,
    emit(event: string, payload?: unknown): boolean {
      const handlers = listeners.get(event) ?? [];
      for (const handler of handlers) {
        handler(payload);
      }
      return handlers.length > 0;
    },
    on(event: string, listener: (...arguments_: unknown[]) => void) {
      const existing = listeners.get(event) ?? [];
      listeners.set(event, [...existing, listener]);
      return this;
    },
  };
}

describe('AmygdalaProcess', () => {
  let events: ReturnType<typeof makeEventBus>;

  beforeEach(() => {
    events = makeEventBus();
  });

  it('insert path: LLM returns insert → ltm.insert called with sessionId and episodeSummary', async () => {
    const entry = makeEntry();
    const ltm = makeLtm();
    const stm = makeStm([entry]);
    const llmAdapter = makeLlmAdapter({
      action: 'insert',
      importanceScore: 0.7,
      reasoning: 'novel',
    });

    const process = new AmygdalaProcess({
      ltm,
      stm,
      llmAdapter,
      events,
      sessionId: TEST_SESSION_ID,
    });
    await process.run();

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(ltm.insert).toHaveBeenCalledWith(entry.summary, {
      importance: 0.7,
      metadata: { source: 'amygdala', insightId: entry.id, tags: [] },
      sessionId: TEST_SESSION_ID,
      episodeSummary: entry.summary,
      tier: 'semantic',
    });
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(stm.markProcessed).toHaveBeenCalledWith([entry.id]);
  });

  it('relate path: LLM returns relate with targetId → ltm.insert + ltm.relate called', async () => {
    const entry = makeEntry();
    const ltm = makeLtm();
    const stm = makeStm([entry]);
    const llmAdapter = makeLlmAdapter({
      action: 'relate',
      targetId: '10',
      edgeType: 'elaborates',
      importanceScore: 0.6,
      reasoning: 'related',
    });

    const process = new AmygdalaProcess({
      ltm,
      stm,
      llmAdapter,
      events,
      sessionId: TEST_SESSION_ID,
    });
    await process.run();

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(ltm.insert).toHaveBeenCalledWith(
      entry.summary,
      expect.objectContaining({ importance: 0.6, sessionId: TEST_SESSION_ID }),
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(ltm.relate).toHaveBeenCalledWith({ fromId: 42, toId: 10, type: 'elaborates' });
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(stm.markProcessed).toHaveBeenCalledWith([entry.id]);
  });

  it('relate without targetId → treated as insert, no relate call', async () => {
    const entry = makeEntry();
    const ltm = makeLtm();
    const stm = makeStm([entry]);
    const llmAdapter = makeLlmAdapter({
      action: 'relate',
      importanceScore: 0.5,
      reasoning: 'no target',
    });

    const process = new AmygdalaProcess({
      ltm,
      stm,
      llmAdapter,
      events,
      sessionId: TEST_SESSION_ID,
    });
    await process.run();

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(ltm.insert).toHaveBeenCalledOnce();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(ltm.relate).not.toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(stm.markProcessed).toHaveBeenCalledWith([entry.id]);
  });

  it('skip path: LLM returns skip → no ltm write, stm.markProcessed still called', async () => {
    const entry = makeEntry();
    const ltm = makeLtm();
    const stm = makeStm([entry]);
    const llmAdapter = makeLlmAdapter({ action: 'skip', importanceScore: 0.1, reasoning: 'noise' });

    const process = new AmygdalaProcess({
      ltm,
      stm,
      llmAdapter,
      events,
      sessionId: TEST_SESSION_ID,
    });
    await process.run();

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(ltm.insert).not.toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(ltm.relate).not.toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(stm.markProcessed).toHaveBeenCalledWith([entry.id]);
  });

  it('retry: LLM fails twice then succeeds → entry still processed', async () => {
    const entry = makeEntry();
    const ltm = makeLtm();
    const stm = makeStm([entry]);
    const llmAdapter = {
      complete: vi.fn(),
      completeStructured: vi
        .fn()
        .mockReturnValueOnce(errAsync(new Error('fail 1')))
        .mockReturnValueOnce(errAsync(new Error('fail 2')))
        .mockReturnValue(okAsync({ action: 'insert', importanceScore: 0.5, reasoning: 'ok' })),
    } as unknown as LLMAdapter;

    const proc = new AmygdalaProcess({
      ltm,
      stm,
      llmAdapter,
      events,
      sessionId: TEST_SESSION_ID,
      _sleep: () => Promise.resolve(),
    });
    await proc.run();

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(ltm.insert).toHaveBeenCalledOnce();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(stm.markProcessed).toHaveBeenCalledWith([entry.id]);
  });

  it('LLM fails 3 times → entry not processed, no crash', async () => {
    const entry = makeEntry();
    const ltm = makeLtm();
    const stm = makeStm([entry]);
    const llmAdapter = {
      complete: vi.fn(),
      completeStructured: vi.fn().mockReturnValue(errAsync(new Error('always fail'))),
    } as unknown as LLMAdapter;

    const proc = new AmygdalaProcess({
      ltm,
      stm,
      llmAdapter,
      events,
      sessionId: TEST_SESSION_ID,
      _sleep: () => Promise.resolve(),
    });
    await proc.run();

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(ltm.insert).not.toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(stm.markProcessed).not.toHaveBeenCalledWith([entry.id]);
    expect(entry.tags).toContain('importance_scoring_failed');
  });

  it('run() drains all pending entries', async () => {
    const entries = [makeEntry(), makeEntry(), makeEntry()];
    const ltm = makeLtm();
    const stm = makeStm(entries);
    const llmAdapter = makeLlmAdapter({ action: 'insert', importanceScore: 0.5, reasoning: 'ok' });

    const process = new AmygdalaProcess({
      ltm,
      stm,
      llmAdapter,
      events,
      sessionId: TEST_SESSION_ID,
      maxBatchSize: 10,
    });
    await process.run();

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(ltm.insert).toHaveBeenCalledTimes(3);
    for (const entry of entries) {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(stm.markProcessed).toHaveBeenCalledWith([entry.id]);
    }
  });

  it('emits amygdala:cycle:start and amygdala:cycle:end events', async () => {
    const entry = makeEntry();
    const ltm = makeLtm();
    const stm = makeStm([entry]);
    const llmAdapter = makeLlmAdapter({ action: 'skip', importanceScore: 0.1, reasoning: 'noise' });

    const cycleStart = vi.fn();
    const cycleEnd = vi.fn();
    events.on('amygdala:cycle:start', cycleStart);
    events.on('amygdala:cycle:end', cycleEnd);

    const process = new AmygdalaProcess({
      ltm,
      stm,
      llmAdapter,
      events,
      sessionId: TEST_SESSION_ID,
    });
    await process.run();

    expect(cycleStart).toHaveBeenCalledOnce();
    expect(cycleEnd).toHaveBeenCalledOnce();
    const endPayload = cycleEnd.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(endPayload.processed).toBe(1);
    expect(endPayload.failures).toBe(0);
  });

  it('emits amygdala:entry:scored for each processed entry', async () => {
    const entry = makeEntry();
    const ltm = makeLtm();
    const stm = makeStm([entry]);
    const llmAdapter = makeLlmAdapter({
      action: 'insert',
      importanceScore: 0.8,
      reasoning: 'important',
    });

    const scored = vi.fn();
    events.on('amygdala:entry:scored', scored);

    const process = new AmygdalaProcess({
      ltm,
      stm,
      llmAdapter,
      events,
      sessionId: TEST_SESSION_ID,
    });
    await process.run();

    expect(scored).toHaveBeenCalledOnce();
    const payload = scored.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.insightId).toBe(entry.id);
    expect(payload.action).toBe('insert');
    expect(payload.importanceScore).toBe(0.8);
  });

  it('defers cycle when lock cannot be acquired', async () => {
    const entry = makeEntry();
    const ltm = makeLtm({
      storage: {
        acquireLock: vi.fn().mockReturnValue(false),
        releaseLock: vi.fn(),
      },
    });
    const stm = makeStm([entry]);
    const llmAdapter = makeLlmAdapter();

    const process = new AmygdalaProcess({
      ltm,
      stm,
      llmAdapter,
      events,
      sessionId: TEST_SESSION_ID,
    });
    await process.run();

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(llmAdapter.completeStructured).not.toHaveBeenCalled();
  });

  it('marks entries llm_rate_limited when max calls per hour exceeded', async () => {
    const entry = makeEntry();
    const ltm = makeLtm();
    const stm = makeStm([entry]);
    const llmAdapter = makeLlmAdapter({ action: 'insert', importanceScore: 0.5, reasoning: 'ok' });

    const process = new AmygdalaProcess({
      ltm,
      stm,
      llmAdapter,
      events,
      sessionId: TEST_SESSION_ID,
      maxLLMCallsPerHour: 0,
    });
    await process.run();

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(llmAdapter.completeStructured).not.toHaveBeenCalled();
    expect(entry.tags).toContain('llm_rate_limited');
  });

  it('entry skipped permanently after 3 consecutive failures across cycles', async () => {
    const entry = makeEntry();
    const ltm = makeLtm();
    const stm = {
      readUnprocessed: vi.fn().mockReturnValue([entry]),
      markProcessed: vi.fn(),
      append: vi.fn(),
      clear: vi.fn(),
    } as unknown as InsightLog;
    const llmAdapter = {
      complete: vi.fn(),
      completeStructured: vi.fn().mockReturnValue(errAsync(new Error('always fail'))),
    } as unknown as LLMAdapter;

    const proc = new AmygdalaProcess({
      ltm,
      stm,
      llmAdapter,
      events,
      sessionId: TEST_SESSION_ID,
      _sleep: () => Promise.resolve(),
    });

    await proc.run();
    await proc.run();
    await proc.run();

    expect(entry.tags).toContain('permanently_skipped');

    await proc.run();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(llmAdapter.completeStructured).toHaveBeenCalledTimes(3 * 3);
  });

  it('ltm.query called with strengthen: false', async () => {
    const entry = makeEntry();
    const ltm = makeLtm();
    const stm = makeStm([entry]);
    const llmAdapter = makeLlmAdapter({ action: 'skip', importanceScore: 0.1, reasoning: 'noise' });

    const process = new AmygdalaProcess({
      ltm,
      stm,
      llmAdapter,
      events,
      sessionId: TEST_SESSION_ID,
    });
    await process.run();

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(ltm.query).toHaveBeenCalledWith(entry.summary, { limit: 3, strengthen: false });
  });

  it('relate path with edgeType supersedes', async () => {
    const entry = makeEntry();
    const ltm = makeLtm();
    const stm = makeStm([entry]);
    const llmAdapter = makeLlmAdapter({
      action: 'relate',
      targetId: '5',
      edgeType: 'supersedes',
      importanceScore: 0.9,
      reasoning: 'supersedes old memory',
    });

    const process = new AmygdalaProcess({
      ltm,
      stm,
      llmAdapter,
      events,
      sessionId: TEST_SESSION_ID,
    });
    await process.run();

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(ltm.relate).toHaveBeenCalledWith({ fromId: 42, toId: 5, type: 'supersedes' });
  });

  it('3.1 inserted LTM record has sessionId matching AmygdalaConfig.sessionId', async () => {
    const entry = makeEntry();
    const ltm = makeLtm();
    const stm = makeStm([entry]);
    const llmAdapter = makeLlmAdapter({ action: 'insert', importanceScore: 0.5, reasoning: 'ok' });

    const process = new AmygdalaProcess({ ltm, stm, llmAdapter, events, sessionId: 'session-xyz' });
    await process.run();

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(ltm.insert).toHaveBeenCalledWith(
      entry.summary,
      expect.objectContaining({ sessionId: 'session-xyz' }),
    );
  });

  it('3.2 inserted LTM record has episodeSummary matching InsightEntry.summary', async () => {
    const entry = makeEntry({ summary: 'User prefers dark mode' });
    const ltm = makeLtm();
    const stm = makeStm([entry]);
    const llmAdapter = makeLlmAdapter({ action: 'insert', importanceScore: 0.6, reasoning: 'ok' });

    const process = new AmygdalaProcess({
      ltm,
      stm,
      llmAdapter,
      events,
      sessionId: TEST_SESSION_ID,
    });
    await process.run();

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(ltm.insert).toHaveBeenCalledWith(
      entry.summary,
      expect.objectContaining({ episodeSummary: 'User prefers dark mode' }),
    );
  });

  it('3.3 context file safeToDelete is true after successful insert', async () => {
    const entry = makeEntry();
    const ltm = makeLtm();
    const stm = makeStm([entry]);
    const llmAdapter = makeLlmAdapter({ action: 'insert', importanceScore: 0.5, reasoning: 'ok' });

    const process = new AmygdalaProcess({
      ltm,
      stm,
      llmAdapter,
      events,
      sessionId: TEST_SESSION_ID,
    });
    await process.run();

    expect(entry.safeToDelete).toBe(true);
  });

  it('3.4 context file safeToDelete remains false after failed LTM write', async () => {
    const entry = makeEntry();
    const ltm = makeLtm({
      insert: vi.fn().mockRejectedValue(new Error('LTM write failed')),
    });
    const stm = makeStm([entry]);
    const llmAdapter = makeLlmAdapter({ action: 'insert', importanceScore: 0.5, reasoning: 'ok' });

    const process = new AmygdalaProcess({
      ltm,
      stm,
      llmAdapter,
      events,
      sessionId: TEST_SESSION_ID,
    });
    try {
      await process.run();
    } catch {
      // expected: LTM write failure propagates out of run()
    }

    expect(entry.safeToDelete).not.toBe(true);
  });

  it('5.1 insert with importanceScore=0.85, no related memories → tier: semantic', async () => {
    const entry = makeEntry();
    const ltm = makeLtm({ query: vi.fn().mockReturnValue(okResult([])) });
    const stm = makeStm([entry]);
    const llmAdapter = makeLlmAdapter({ action: 'insert', importanceScore: 0.85, reasoning: 'ok' });

    const process = new AmygdalaProcess({
      ltm,
      stm,
      llmAdapter,
      events,
      sessionId: TEST_SESSION_ID,
    });
    await process.run();

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(ltm.insert).toHaveBeenCalledWith(
      entry.summary,
      expect.objectContaining({ tier: 'semantic' }),
    );
  });

  it('5.2 insert with importanceScore=0.85, non-empty related memories → tier: episodic', async () => {
    const entry = makeEntry();
    const related = [{ record: { data: 'existing memory', id: 1 } }];
    const ltm = makeLtm({ query: vi.fn().mockReturnValue(okResult(related)) });
    const stm = makeStm([entry]);
    const llmAdapter = makeLlmAdapter({ action: 'insert', importanceScore: 0.85, reasoning: 'ok' });

    const process = new AmygdalaProcess({
      ltm,
      stm,
      llmAdapter,
      events,
      sessionId: TEST_SESSION_ID,
    });
    await process.run();

    const call = (ltm.insert as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Record<
      string,
      unknown
    >;
    expect(call.tier).toBeUndefined();
  });

  it('5.3 insert with importanceScore=0.5, no related memories → tier: episodic', async () => {
    const entry = makeEntry();
    const ltm = makeLtm({ query: vi.fn().mockReturnValue(okResult([])) });
    const stm = makeStm([entry]);
    const llmAdapter = makeLlmAdapter({ action: 'insert', importanceScore: 0.5, reasoning: 'ok' });

    const process = new AmygdalaProcess({
      ltm,
      stm,
      llmAdapter,
      events,
      sessionId: TEST_SESSION_ID,
    });
    await process.run();

    const call = (ltm.insert as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Record<
      string,
      unknown
    >;
    expect(call.tier).toBeUndefined();
  });

  it('5.4 action=relate with importanceScore=0.9, no related memories → tier: episodic', async () => {
    const entry = makeEntry();
    const ltm = makeLtm({ query: vi.fn().mockReturnValue(okResult([])) });
    const stm = makeStm([entry]);
    const llmAdapter = makeLlmAdapter({
      action: 'relate',
      targetId: '7',
      edgeType: 'elaborates',
      importanceScore: 0.9,
      reasoning: 'ok',
    });

    const process = new AmygdalaProcess({
      ltm,
      stm,
      llmAdapter,
      events,
      sessionId: TEST_SESSION_ID,
    });
    await process.run();

    const call = (ltm.insert as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Record<
      string,
      unknown
    >;
    expect(call.tier).toBeUndefined();
  });

  it('5.5 custom singletonPromotionThreshold=0.9 → importanceScore=0.85 stays episodic', async () => {
    const entry = makeEntry();
    const ltm = makeLtm({ query: vi.fn().mockReturnValue(okResult([])) });
    const stm = makeStm([entry]);
    const llmAdapter = makeLlmAdapter({ action: 'insert', importanceScore: 0.85, reasoning: 'ok' });

    const process = new AmygdalaProcess({
      ltm,
      stm,
      llmAdapter,
      events,
      sessionId: TEST_SESSION_ID,
      singletonPromotionThreshold: 0.9,
    });
    await process.run();

    const call = (ltm.insert as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Record<
      string,
      unknown
    >;
    expect(call.tier).toBeUndefined();
  });

  it('5.6 entry.tags=[behavioral, llm_rate_limited] → metadata.tags=[behavioral]', async () => {
    const entry = makeEntry({ tags: ['behavioral', 'llm_rate_limited'] });
    const ltm = makeLtm();
    const stm = makeStm([entry]);
    const llmAdapter = makeLlmAdapter({ action: 'insert', importanceScore: 0.5, reasoning: 'ok' });

    const process = new AmygdalaProcess({
      ltm,
      stm,
      llmAdapter,
      events,
      sessionId: TEST_SESSION_ID,
    });
    await process.run();

    const call = (ltm.insert as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Record<
      string,
      unknown
    >;
    expect((call.metadata as Record<string, unknown>).tags).toEqual(['behavioral']);
  });

  it('5.7 entry.tags=[permanently_skipped, llm_rate_limited] → metadata.tags=[]', async () => {
    const entry = makeEntry({ tags: ['permanently_skipped', 'llm_rate_limited'] });
    const ltm = makeLtm();
    const stm = makeStm([entry]);
    const scoringResult = { action: 'insert' as const, importanceScore: 0.5, reasoning: 'ok' };

    await applyAction({
      entry,
      scoringResult,
      relatedMemories: [],
      ltm,
      stm,
      events,
      sessionId: TEST_SESSION_ID,
      singletonPromotionThreshold: 0.7,
    });

    const call = (ltm.insert as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Record<
      string,
      unknown
    >;
    expect((call.metadata as Record<string, unknown>).tags).toEqual([]);
  });

  it('5.8 entry.tags=[] → metadata.tags=[]', async () => {
    const entry = makeEntry({ tags: [] });
    const ltm = makeLtm();
    const stm = makeStm([entry]);
    const llmAdapter = makeLlmAdapter({ action: 'insert', importanceScore: 0.5, reasoning: 'ok' });

    const process = new AmygdalaProcess({
      ltm,
      stm,
      llmAdapter,
      events,
      sessionId: TEST_SESSION_ID,
    });
    await process.run();

    const call = (ltm.insert as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Record<
      string,
      unknown
    >;
    expect((call.metadata as Record<string, unknown>).tags).toEqual([]);
  });

  it('5.9 relate action: new record carries filtered tags', async () => {
    const entry = makeEntry({ tags: ['behavioral', 'llm_rate_limited'] });
    const ltm = makeLtm();
    const stm = makeStm([entry]);
    const llmAdapter = makeLlmAdapter({
      action: 'relate',
      targetId: '3',
      edgeType: 'elaborates',
      importanceScore: 0.6,
      reasoning: 'ok',
    });

    const process = new AmygdalaProcess({
      ltm,
      stm,
      llmAdapter,
      events,
      sessionId: TEST_SESSION_ID,
    });
    await process.run();

    const call = (ltm.insert as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Record<
      string,
      unknown
    >;
    expect((call.metadata as Record<string, unknown>).tags).toEqual(['behavioral']);
  });
});
