import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { readContextFiles } from '../shell/clients/context-reader.js';

let temporaryDirectory: string;

beforeEach(() => {
  temporaryDirectory = path.join(tmpdir(), `context-reader-test-${Date.now().toString()}`);
  mkdirSync(temporaryDirectory, { recursive: true });
});

afterEach(() => {
  rmSync(temporaryDirectory, { recursive: true, force: true });
});

describe('readContextFiles', () => {
  test('returns empty array when session directory does not exist', () => {
    const result = readContextFiles({
      contextDir: temporaryDirectory,
      sessionId: 'nonexistent',
      limit: 3,
    });
    expect(result).toEqual([]);
  });

  test('returns empty array when context dir does not exist', () => {
    const result = readContextFiles({
      contextDir: '/nonexistent/path',
      sessionId: 'sess',
      limit: 3,
    });
    expect(result).toEqual([]);
  });

  test('returns files sorted by mtime descending', async () => {
    const sessionDirectory = path.join(temporaryDirectory, 'sess-123');
    mkdirSync(sessionDirectory, { recursive: true });

    writeFileSync(path.join(sessionDirectory, 'a.md'), 'first', 'utf8');
    await new Promise((resolve) => setTimeout(resolve, 10));
    writeFileSync(path.join(sessionDirectory, 'b.md'), 'second', 'utf8');
    await new Promise((resolve) => setTimeout(resolve, 10));
    writeFileSync(path.join(sessionDirectory, 'c.md'), 'third', 'utf8');

    const result = readContextFiles({
      contextDir: temporaryDirectory,
      sessionId: 'sess-123',
      limit: 3,
    });
    expect(result).toEqual(['third', 'second', 'first']);
  });

  test('respects limit', async () => {
    const sessionDirectory = path.join(temporaryDirectory, 'sess-456');
    mkdirSync(sessionDirectory, { recursive: true });

    writeFileSync(path.join(sessionDirectory, 'a.md'), 'first', 'utf8');
    await new Promise((resolve) => setTimeout(resolve, 10));
    writeFileSync(path.join(sessionDirectory, 'b.md'), 'second', 'utf8');
    await new Promise((resolve) => setTimeout(resolve, 10));
    writeFileSync(path.join(sessionDirectory, 'c.md'), 'third', 'utf8');

    const result = readContextFiles({
      contextDir: temporaryDirectory,
      sessionId: 'sess-456',
      limit: 2,
    });
    expect(result).toHaveLength(2);
    expect(result).toEqual(['third', 'second']);
  });
});
