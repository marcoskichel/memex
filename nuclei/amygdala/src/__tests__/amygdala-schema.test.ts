import { describe, expect, it } from 'vitest';

import { amygdalaScoringSchema } from '../amygdala-schema.js';

describe('amygdalaScoringSchema.parse', () => {
  it('parses valid entities array and lowercases names', () => {
    const result = amygdalaScoringSchema.parse({
      action: 'insert',
      importanceScore: 0.5,
      reasoning: 'ok',
      entities: [
        { name: 'Marcos', type: 'person' },
        { name: 'TypeScript', type: 'tool' },
      ],
    });
    expect(result.entities).toEqual([
      { name: 'marcos', type: 'person' },
      { name: 'typescript', type: 'tool' },
    ]);
  });

  it('lowercases uppercase entity name', () => {
    const result = amygdalaScoringSchema.parse({
      action: 'insert',
      importanceScore: 0.5,
      reasoning: 'ok',
      entities: [{ name: 'Alice Smith', type: 'person' }],
    });
    expect(result.entities).toEqual([{ name: 'alice smith', type: 'person' }]);
  });

  it('lowercases mixed-case tool name', () => {
    const result = amygdalaScoringSchema.parse({
      action: 'insert',
      importanceScore: 0.5,
      reasoning: 'ok',
      entities: [{ name: 'SQLite', type: 'tool' }],
    });
    expect(result.entities).toEqual([{ name: 'sqlite', type: 'tool' }]);
  });

  it('leaves already-lowercase names unchanged', () => {
    const result = amygdalaScoringSchema.parse({
      action: 'insert',
      importanceScore: 0.5,
      reasoning: 'ok',
      entities: [{ name: 'sqlite', type: 'tool' }],
    });
    expect(result.entities).toEqual([{ name: 'sqlite', type: 'tool' }]);
  });

  it('defaults to empty array when entities field is missing', () => {
    const result = amygdalaScoringSchema.parse({
      action: 'insert',
      importanceScore: 0.5,
      reasoning: 'ok',
    });
    expect(result.entities).toEqual([]);
  });

  it('defaults to empty array when entities field is malformed', () => {
    const result = amygdalaScoringSchema.parse({
      action: 'insert',
      importanceScore: 0.5,
      reasoning: 'ok',
      entities: 'not-an-array',
    });
    expect(result.entities).toEqual([]);
  });

  it('filters out entities with invalid type', () => {
    const result = amygdalaScoringSchema.parse({
      action: 'insert',
      importanceScore: 0.5,
      reasoning: 'ok',
      entities: [
        { name: 'Valid', type: 'person' },
        { name: 'Invalid', type: 'unknown-type' },
      ],
    });
    expect(result.entities).toEqual([{ name: 'valid', type: 'person' }]);
  });

  it('returns empty entities on skip action', () => {
    const result = amygdalaScoringSchema.parse({
      action: 'skip',
      importanceScore: 0.1,
      reasoning: 'noise',
      entities: [],
    });
    expect(result.entities).toEqual([]);
  });

  it('falls back to skip with empty entities on invalid action', () => {
    const result = amygdalaScoringSchema.parse({ action: 'invalid' });
    expect(result.action).toBe('skip');
    expect(result.entities).toEqual([]);
  });
});
