import type { EntityNode } from '@neurome/ltm';
import { describe, expect, it } from 'vitest';

import { buildEntityInsertPlan } from '../core/insert-plan.js';
import type { EntityResolution, ExtractedEntity } from '../core/types.js';

function makeExtracted(name = 'alice'): ExtractedEntity {
  return { name, type: 'person', embedding: new Float32Array([1, 0, 0]) };
}

function makeCandidate(id: number): EntityNode {
  return {
    id,
    name: 'alice',
    type: 'person',
    embedding: new Float32Array([1, 0, 0]),
    createdAt: new Date(),
  };
}

describe('buildEntityInsertPlan', () => {
  it('distinct entity goes to toInsert', () => {
    const extracted = makeExtracted();
    const resolutions: EntityResolution[] = [{ type: 'distinct', extracted }];
    const plan = buildEntityInsertPlan(resolutions, []);
    expect(plan.toInsert).toContain(extracted);
    expect(plan.toReuse).toHaveLength(0);
  });

  it('merge entity goes to toReuse with entityId', () => {
    const extracted = makeExtracted();
    const resolutions: EntityResolution[] = [{ type: 'merge', entityId: 5, extracted }];
    const plan = buildEntityInsertPlan(resolutions, []);
    expect(plan.toReuse).toHaveLength(1);
    expect(plan.toReuse[0]).toMatchObject({ extracted, entityId: 5 });
    expect(plan.toInsert).toHaveLength(0);
  });

  it('exact entity goes to toReuse with entityId', () => {
    const extracted = makeExtracted();
    const resolutions: EntityResolution[] = [{ type: 'exact', entityId: 7, extracted }];
    const plan = buildEntityInsertPlan(resolutions, []);
    expect(plan.toReuse).toHaveLength(1);
    expect(plan.toReuse[0]).toMatchObject({ extracted, entityId: 7 });
  });

  it('llm-needed entity goes to llmNeeded', () => {
    const extracted = makeExtracted();
    const candidates = [makeCandidate(3)];
    const resolutions: EntityResolution[] = [{ type: 'llm-needed', extracted, candidates }];
    const plan = buildEntityInsertPlan(resolutions, []);
    expect(plan.llmNeeded).toHaveLength(1);
    expect(plan.llmNeeded[0]).toMatchObject({ extracted, candidates });
  });

  it('edges are passed through unchanged', () => {
    const edge = { fromName: 'alice', toName: 'project-x', relationshipType: 'works_on' };
    const plan = buildEntityInsertPlan([], [edge]);
    expect(plan.edgesToInsert).toContain(edge);
  });
});
