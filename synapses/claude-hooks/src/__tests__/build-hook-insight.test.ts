import { describe, expect, test } from 'vitest';

import { buildHookInsight } from '../core/build-hook-insight.js';

describe('buildHookInsight', () => {
  test('produces correct summary format', () => {
    const result = buildHookInsight({
      toolName: 'Read',
      input: { file_path: '/tmp/foo.ts' },
      sessionId: 'sess-abc',
      agentName: 'claude',
    });
    expect(result.summary).toBe('Tool called: Read — {"file_path":"/tmp/foo.ts"}');
  });

  test('truncates serialized input to 500 chars', () => {
    const longValue = 'x'.repeat(600);
    const result = buildHookInsight({
      toolName: 'Bash',
      input: { command: longValue },
      sessionId: 'sess-abc',
      agentName: 'claude',
    });
    const serialized = result.summary.replace('Tool called: Bash — ', '');
    expect(serialized.length).toBeLessThanOrEqual(500);
  });

  test('includes all required tags', () => {
    const result = buildHookInsight({
      toolName: 'Write',
      input: { file_path: '/a.ts' },
      sessionId: 'sess-xyz',
      agentName: 'claude',
    });
    expect(result.tags).toContain('navigation');
    expect(result.tags).toContain('tool:Write');
    expect(result.tags).toContain('agent:claude');
    expect(result.tags).toContain('run:sess-xyz');
  });

  test('default agentName is "claude"', () => {
    const result = buildHookInsight({ toolName: 'Read', input: {}, sessionId: 'sess-1' });
    expect(result.tags).toContain('agent:claude');
  });

  test('custom agentName is reflected in agent: tag', () => {
    const result = buildHookInsight({
      toolName: 'Read',
      input: {},
      sessionId: 'sess-1',
      agentName: 'my-agent',
    });
    expect(result.tags).toContain('agent:my-agent');
    expect(result.tags).not.toContain('agent:claude');
  });

  test('run: tag matches sessionId', () => {
    const result = buildHookInsight({
      toolName: 'Bash',
      input: {},
      sessionId: 'my-session-id',
      agentName: 'claude',
    });
    expect(result.tags).toContain('run:my-session-id');
  });

  test('contextFile is empty string', () => {
    const result = buildHookInsight({ toolName: 'Read', input: {}, sessionId: 'sess-1' });
    expect(result.contextFile).toBe('');
  });
});
