import type { LLMAdapter } from '@neurokit/llm';
import type { LtmEngine } from '@neurokit/ltm';
import type { InsightEntry, InsightLog } from '@neurokit/stm';

import type {
  AmygdalaScoringResult,
  EntryOutcome,
  EventBus,
  LtmWithStorage,
} from './amygdala-schema.js';
import {
  amygdalaScoringSchema,
  buildPrompt,
  buildPromptWithContext,
  DEFAULT_CADENCE_MS,
  DEFAULT_LOW_COST_MODE_THRESHOLD,
  DEFAULT_MAX_BATCH_SIZE,
  DEFAULT_MAX_LLM_CALLS_PER_HOUR,
  ESTIMATED_TOKENS_PER_CALL,
  HOUR_MS,
  LOW_COST_MAX_RELATED,
  MAX_CONSECUTIVE_FAILURES,
  MAX_RELATED_MEMORIES,
  readContextExcerpt,
  RETRY_DELAYS_MS,
  sleep,
  STM_THRESHOLD,
  SYSTEM_PROMPT,
  THRESHOLD_CHECK_INTERVAL_MS,
} from './amygdala-schema.js';

export type { AmygdalaScoringResult, EventBus } from './amygdala-schema.js';

export interface AmygdalaConfig {
  ltm: LtmEngine;
  stm: InsightLog;
  llmAdapter: LLMAdapter;
  sessionId: string;
  cadenceMs?: number;
  maxBatchSize?: number;
  maxLLMCallsPerHour?: number;
  lowCostModeThreshold?: number;
  events?: EventBus;
  _sleep?: (ms: number) => Promise<void>;
}

export class AmygdalaProcess {
  private ltm: LtmEngine;
  private stm: InsightLog;
  private llmAdapter: LLMAdapter;
  private sessionId: string;
  private cadenceMs: number;
  private maxBatchSize: number;
  private maxLLMCallsPerHour: number;
  private lowCostModeThreshold: number;
  private events: EventBus;
  private intervalId: ReturnType<typeof setInterval> | undefined;
  private thresholdCheckId: ReturnType<typeof setInterval> | undefined;
  private callsThisHour = 0;
  private hourWindowStart = Date.now();
  private consecutiveFailures = new Map<string, number>();
  private sleepFn: (ms: number) => Promise<void>;

  constructor(config: AmygdalaConfig) {
    this.ltm = config.ltm;
    this.stm = config.stm;
    this.llmAdapter = config.llmAdapter;
    this.sessionId = config.sessionId;
    this.cadenceMs = config.cadenceMs ?? DEFAULT_CADENCE_MS;
    this.maxBatchSize = config.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE;
    this.maxLLMCallsPerHour = config.maxLLMCallsPerHour ?? DEFAULT_MAX_LLM_CALLS_PER_HOUR;
    this.lowCostModeThreshold = config.lowCostModeThreshold ?? DEFAULT_LOW_COST_MODE_THRESHOLD;
    this.events = config.events ?? { emit: () => false, on: () => false };
    this.sleepFn = config._sleep ?? sleep;
  }

  start(): void {
    this.intervalId = setInterval(() => {
      void this.run();
    }, this.cadenceMs);
    this.thresholdCheckId = setInterval(() => {
      if (this.stm.readUnprocessed().length >= STM_THRESHOLD) {
        void this.run();
      }
    }, THRESHOLD_CHECK_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId !== undefined) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    if (this.thresholdCheckId !== undefined) {
      clearInterval(this.thresholdCheckId);
      this.thresholdCheckId = undefined;
    }
  }

  async run(): Promise<void> {
    this.resetHourWindowIfNeeded();

    const { storage } = this.ltm as unknown as LtmWithStorage;
    const hasLock = storage.acquireLock !== undefined;

    if (hasLock && !storage.acquireLock?.('amygdala', this.cadenceMs * 2)) {
      console.warn('[amygdala] Could not acquire lock, deferring cycle');
      return;
    }

    const cycleId = crypto.randomUUID();
    const startedAt = new Date();
    const batch = this.selectBatch();
    this.events.emit('amygdala:cycle:start', { cycleId, pendingCount: batch.length, startedAt });

    let processed = 0;
    let failures = 0;
    let llmCalls = 0;

    try {
      for (const entry of batch) {
        const outcome = await this.processEntry(entry);
        processed += outcome.processed;
        failures += outcome.failures;
        llmCalls += outcome.llmCalls;
      }
    } finally {
      if (hasLock) {
        storage.releaseLock?.('amygdala');
      }
      this.events.emit('amygdala:cycle:end', {
        cycleId,
        durationMs: Date.now() - startedAt.getTime(),
        processed,
        failures,
        llmCalls,
        estimatedTokens: llmCalls * ESTIMATED_TOKENS_PER_CALL,
      });
    }
  }

  private selectBatch(): InsightEntry[] {
    return this.stm
      .readUnprocessed()
      .filter((entry) => {
        const failures = this.consecutiveFailures.get(entry.id) ?? 0;
        return failures < MAX_CONSECUTIVE_FAILURES && !entry.tags.includes('permanently_skipped');
      })
      .slice(0, this.maxBatchSize);
  }

  private async processEntry(entry: InsightEntry): Promise<EntryOutcome> {
    this.resetHourWindowIfNeeded();

    if (this.callsThisHour >= this.maxLLMCallsPerHour) {
      this.stm.markProcessed([]);
      entry.tags.push('llm_rate_limited');
      return { processed: 0, failures: 1, llmCalls: 0 };
    }

    const isLowCost = this.callsThisHour >= this.lowCostModeThreshold;
    const contextExcerpt = isLowCost ? undefined : await readContextExcerpt(entry.contextFile);
    const relatedMemories = await this.fetchRelatedMemories(entry.summary, isLowCost);
    const prompt = contextExcerpt
      ? buildPromptWithContext({ summary: entry.summary, contextExcerpt, relatedMemories })
      : buildPrompt(entry.summary, relatedMemories);

    const { result: scoringResult, llmCalls } = await this.scoreWithRetry(prompt);

    if (!scoringResult) {
      return this.handleScoringFailure(entry);
    }

    this.consecutiveFailures.delete(entry.id);
    await this.applyAction(entry, scoringResult);
    return { processed: 1, failures: 0, llmCalls };
  }

  private async fetchRelatedMemories(
    summary: string,
    isLowCost: boolean,
  ): Promise<{ data: string; id: number }[]> {
    const limit = isLowCost ? LOW_COST_MAX_RELATED : MAX_RELATED_MEMORIES;
    const queryResult = await this.ltm.query(summary, { limit, strengthen: false });
    if (!queryResult.isOk()) {
      return [];
    }
    return queryResult.value.map((record) => ({ data: record.record.data, id: record.record.id }));
  }

  private async scoreWithRetry(
    prompt: string,
  ): Promise<{ result: AmygdalaScoringResult | undefined; llmCalls: number }> {
    let llmCalls = 0;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      const callResult = await this.llmAdapter.completeStructured({
        prompt,
        schema: amygdalaScoringSchema,
        options: { systemPrompt: SYSTEM_PROMPT },
      });

      this.callsThisHour++;
      if (callResult.isOk()) {
        llmCalls++;
        return { result: callResult.value, llmCalls };
      }
      if (attempt < RETRY_DELAYS_MS.length) {
        const delay = RETRY_DELAYS_MS[attempt];
        if (delay !== undefined) {
          await this.sleepFn(delay);
        }
      }
    }
    return { result: undefined, llmCalls };
  }

  private handleScoringFailure(entry: InsightEntry): EntryOutcome {
    const newFailures = (this.consecutiveFailures.get(entry.id) ?? 0) + 1;
    this.consecutiveFailures.set(entry.id, newFailures);
    entry.tags.push('importance_scoring_failed');
    if (newFailures >= MAX_CONSECUTIVE_FAILURES) {
      entry.tags.push('permanently_skipped');
      console.warn(
        `[amygdala] Entry ${entry.id} permanently skipped after ${newFailures.toString()} consecutive failures`,
      );
    }
    return { processed: 0, failures: 1, llmCalls: 0 };
  }

  private async applyAction(
    entry: InsightEntry,
    scoringResult: AmygdalaScoringResult,
  ): Promise<void> {
    const action =
      scoringResult.action === 'relate' && !scoringResult.targetId
        ? 'insert'
        : scoringResult.action;
    let relatedToId: number | undefined;

    if (action === 'insert' || action === 'relate') {
      const newId = await this.ltm.insert(entry.summary, {
        importance: scoringResult.importanceScore,
        metadata: { source: 'amygdala', insightId: entry.id },
        sessionId: this.sessionId,
        episodeSummary: entry.summary,
      });
      entry.safeToDelete = true;
      if (action === 'relate' && scoringResult.targetId) {
        relatedToId = Number.parseInt(scoringResult.targetId, 10);
        const edgeType = scoringResult.edgeType ?? 'elaborates';
        this.ltm.relate({ fromId: newId, toId: relatedToId, type: edgeType });
      }
    }

    this.stm.markProcessed([entry.id]);
    entry.tags = entry.tags.filter((tag) => tag !== 'llm_rate_limited');
    this.events.emit('amygdala:entry:scored', {
      insightId: entry.id,
      action: scoringResult.action,
      importanceScore: scoringResult.importanceScore,
      relatedToId,
      edgeType: scoringResult.edgeType,
    });
  }

  private resetHourWindowIfNeeded(): void {
    const now = Date.now();
    if (now - this.hourWindowStart >= HOUR_MS) {
      this.callsThisHour = 0;
      this.hourWindowStart = now;
    }
  }
}
