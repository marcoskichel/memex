import { describe, expect, it } from 'vitest';

import { amygdalaScoringSchema, buildSystemPrompt, SYSTEM_PROMPT } from '../amygdala-schema.js';

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

  it('accepts any non-empty entity type string', () => {
    const result = amygdalaScoringSchema.parse({
      action: 'insert',
      importanceScore: 0.5,
      reasoning: 'ok',
      entities: [
        { name: 'Valid', type: 'person' },
        { name: 'HomeScreen', type: 'screen' },
        { name: 'Custom', type: 'unknown-type' },
      ],
    });
    expect(result.entities).toEqual([
      { name: 'valid', type: 'person' },
      { name: 'homescreen', type: 'screen' },
      { name: 'custom', type: 'unknown-type' },
    ]);
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

  it('parses goalRelevance and clamps to [0, 1]', () => {
    const result = amygdalaScoringSchema.parse({
      action: 'insert',
      importanceScore: 0.5,
      reasoning: 'ok',
      entities: [],
      goalRelevance: 0.8,
    });
    expect(result.goalRelevance).toBe(0.8);
  });

  it('clamps goalRelevance above 1 to 1', () => {
    const result = amygdalaScoringSchema.parse({
      action: 'insert',
      importanceScore: 0.5,
      reasoning: 'ok',
      entities: [],
      goalRelevance: 1.5,
    });
    expect(result.goalRelevance).toBe(1);
  });

  it('returns goalRelevance undefined when absent', () => {
    const result = amygdalaScoringSchema.parse({
      action: 'insert',
      importanceScore: 0.5,
      reasoning: 'ok',
      entities: [],
    });
    expect(result.goalRelevance).toBeUndefined();
  });
});

describe('buildSystemPrompt', () => {
  it('returns SYSTEM_PROMPT unchanged when no args', () => {
    expect(buildSystemPrompt()).toBe(SYSTEM_PROMPT);
  });

  it('appends agent state hint at the end', () => {
    const result = buildSystemPrompt('focused');
    expect(result).toContain(SYSTEM_PROMPT);
    expect(result.endsWith('raise bar for routine/distraction observations.')).toBe(true);
  });

  it('prepends profile block before SYSTEM_PROMPT when profile has purpose', () => {
    const result = buildSystemPrompt(undefined, { purpose: 'Find UI bugs' });
    expect(result.indexOf('Find UI bugs')).toBeLessThan(result.indexOf(SYSTEM_PROMPT));
    expect(result).toContain('goalRelevance');
  });

  it('prepends profile block before SYSTEM_PROMPT when profile has type only', () => {
    const result = buildSystemPrompt(undefined, { type: 'qa' });
    expect(result.indexOf('Type: qa')).toBeLessThan(result.indexOf(SYSTEM_PROMPT));
    expect(result).not.toContain('Purpose:');
  });

  it('prepends profile block before SYSTEM_PROMPT when profile has purpose only', () => {
    const result = buildSystemPrompt(undefined, { purpose: 'Debug auth flow' });
    expect(result).toContain('Purpose: Debug auth flow');
    expect(result).not.toContain('Type:');
  });

  it('includes both profile and state hint when both provided', () => {
    const result = buildSystemPrompt('learning', { type: 'qa', purpose: 'Find bugs' });
    expect(result.indexOf('Find bugs')).toBeLessThan(result.indexOf(SYSTEM_PROMPT));
    expect(result).toContain('raise importance for novel/unexpected observations.');
  });

  it('truncates purpose at 200 characters', () => {
    const longPurpose = 'x'.repeat(300);
    const result = buildSystemPrompt(undefined, { purpose: longPurpose });
    expect(result).toContain('x'.repeat(200));
    expect(result).not.toContain('x'.repeat(201));
  });
});
