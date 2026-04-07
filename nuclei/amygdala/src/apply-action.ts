import type { LtmEngine } from '@neurome/ltm';
import type { InsightEntry, InsightLogLike } from '@neurome/stm';

import type { AmygdalaScoringResult, EventBus } from './amygdala-schema.js';
import { INTERNAL_TAGS } from './amygdala-schema.js';

export interface ApplyActionOptions {
  entry: InsightEntry;
  scoringResult: AmygdalaScoringResult;
  relatedMemories: { data: string; id: number }[];
  ltm: LtmEngine;
  stm: InsightLogLike;
  events: EventBus;
  engramId: string;
  singletonPromotionThreshold: number;
}

interface InsertContext {
  entry: InsightEntry;
  scoringResult: AmygdalaScoringResult;
  relatedMemories: { data: string; id: number }[];
  ltm: LtmEngine;
  engramId: string;
  singletonPromotionThreshold: number;
  action: string;
}

async function insertAndRelate(
  context: InsertContext,
): Promise<{ relatedToId: number | undefined } | false> {
  const { entry, scoringResult, ltm, engramId, singletonPromotionThreshold, action } = context;
  const isSingleton = context.relatedMemories.length === 0;
  const qualifiesForPromotion =
    action === 'insert' &&
    scoringResult.importanceScore >= singletonPromotionThreshold &&
    isSingleton;
  const forwardedTags = entry.tags.filter((tag) => !INTERNAL_TAGS.includes(tag));
  const insertOk = await ltm
    .insert(entry.summary, {
      importance: scoringResult.importanceScore,
      metadata: {
        source: 'amygdala',
        insightId: entry.id,
        tags: forwardedTags,
        entities: scoringResult.entities,
      },
      engramId,
      episodeSummary: entry.summary,
      ...(qualifiesForPromotion && { tier: 'semantic' }),
    })
    .match(
      (id) => ({ id }),
      () => false as const,
    );
  if (!insertOk) {
    return false;
  }
  entry.safeToDelete = true;
  let relatedToId: number | undefined;
  if (action === 'relate' && scoringResult.targetId) {
    relatedToId = Number.parseInt(scoringResult.targetId, 10);
    const edgeType = scoringResult.edgeType ?? 'elaborates';
    ltm.relate({ fromId: insertOk.id, toId: relatedToId, type: edgeType });
  }
  return { relatedToId };
}

export async function applyAction(options: ApplyActionOptions): Promise<void> {
  const { entry, scoringResult, stm, events } = options;
  const action =
    scoringResult.action === 'relate' && !scoringResult.targetId ? 'insert' : scoringResult.action;
  let relatedToId: number | undefined;

  if (action === 'insert' || action === 'relate') {
    const result = await insertAndRelate({ ...options, action });
    if (!result) {
      return;
    }
    relatedToId = result.relatedToId;
  }

  stm.markProcessed([entry.id]);
  entry.tags = entry.tags.filter((tag) => tag !== 'llm_rate_limited');
  events.emit('amygdala:entry:scored', {
    insightId: entry.id,
    action: scoringResult.action,
    importanceScore: scoringResult.importanceScore,
    relatedToId,
    edgeType: scoringResult.edgeType,
  });
}
