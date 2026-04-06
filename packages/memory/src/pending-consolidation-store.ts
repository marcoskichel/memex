import type { LtmEngine } from '@neurome/ltm';
import { errAsync, type ResultAsync } from 'neverthrow';

import { InsertMemoryError, type PendingConsolidation } from './memory-types.js';

export class PendingConsolidationStore {
  private map = new Map<string, PendingConsolidation>();
  private readonly ttlMs: number;

  constructor(ttlMs: number) {
    this.ttlMs = ttlMs;
  }

  add(pending: PendingConsolidation): void {
    this.map.set(pending.pendingId, pending);
  }

  all(): PendingConsolidation[] {
    return [...this.map.values()];
  }

  approve(pendingId: string, ltm: LtmEngine): ResultAsync<number, InsertMemoryError> {
    const pending = this.map.get(pendingId);
    if (!pending) {
      return errAsync(new InsertMemoryError('pending_not_found'));
    }
    this.map.delete(pendingId);
    return ltm
      .consolidate(pending.sourceIds, {
        data: pending.summary,
        options: {
          confidence: pending.confidence,
          preservedFacts: pending.preservedFacts,
          uncertainties: pending.uncertainties,
        },
      })
      .mapErr((error) => new InsertMemoryError(error.type));
  }

  discard(pendingId: string): void {
    this.map.delete(pendingId);
  }

  purgeStale(): void {
    const cutoff = Date.now() - this.ttlMs;
    for (const [id, pending] of this.map) {
      if (pending.createdAt.getTime() < cutoff) {
        this.map.delete(id);
      }
    }
  }
}
