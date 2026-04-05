import { describe, expect, test } from 'vitest';

import { formatContext } from '../core/format-context.js';

describe('formatContext', () => {
  test('returns empty string for empty array', () => {
    expect(formatContext([])).toBe('');
  });

  test('returns file content as-is for single file', () => {
    expect(formatContext(['hello world'])).toBe('hello world');
  });

  test('joins multiple files with separator', () => {
    const result = formatContext(['file one', 'file two', 'file three']);
    expect(result).toBe('file one\n\n---\n\nfile two\n\n---\n\nfile three');
  });
});
