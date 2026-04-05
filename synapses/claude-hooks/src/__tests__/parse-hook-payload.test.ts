import { describe, expect, test } from 'vitest';

import { parsePostToolUse, parsePreToolUse } from '../core/parse-hook-payload.js';

const validPostPayload = {
  session_id: 'sess-123',
  tool_name: 'Read',
  tool_input: { file_path: '/foo/bar.ts' },
  tool_response: { content: 'hello' },
};

const validPrePayload = {
  session_id: 'sess-123',
  tool_name: 'Read',
  tool_input: { file_path: '/foo/bar.ts' },
};

describe('parsePostToolUse', () => {
  test('parses valid post-tool-use payload', () => {
    const result = parsePostToolUse(JSON.stringify(validPostPayload));
    expect(result).toEqual(validPostPayload);
  });

  test('returns undefined for invalid JSON', () => {
    const result = parsePostToolUse('not json {{{');
    expect(result).toBeUndefined();
  });

  test('returns undefined for missing required fields', () => {
    const result = parsePostToolUse(JSON.stringify({ session_id: 'x' }));
    expect(result).toBeUndefined();
  });

  test('returns undefined when tool_input is not a record', () => {
    const result = parsePostToolUse(
      JSON.stringify({
        session_id: 'sess-123',
        tool_name: 'Read',
        tool_input: 'not-a-record',
        tool_response: {},
      }),
    );
    expect(result).toBeUndefined();
  });
});

describe('parsePreToolUse', () => {
  test('parses valid pre-tool-use payload', () => {
    const result = parsePreToolUse(JSON.stringify(validPrePayload));
    expect(result).toEqual(validPrePayload);
  });

  test('returns undefined for invalid JSON', () => {
    const result = parsePreToolUse('{{{bad');
    expect(result).toBeUndefined();
  });

  test('returns undefined for missing required fields', () => {
    const result = parsePreToolUse(JSON.stringify({ tool_name: 'Read' }));
    expect(result).toBeUndefined();
  });
});
