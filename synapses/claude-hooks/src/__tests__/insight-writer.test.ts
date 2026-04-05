import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { SqliteInsightLog } from '@neurokit/stm';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { writeInsight } from '../shell/clients/insight-writer.js';

const payload = {
  session_id: 'sess-abc',
  tool_name: 'Read',
  tool_input: { file_path: '/tmp/foo.ts' },
  tool_response: { content: 'some content' },
};

let temporaryDirectory: string;
let dbPath: string;

beforeEach(() => {
  temporaryDirectory = path.join(tmpdir(), `insight-writer-test-${Date.now().toString()}`);
  mkdirSync(temporaryDirectory, { recursive: true });
  dbPath = path.join(temporaryDirectory, 'test.db');
});

afterEach(() => {
  rmSync(temporaryDirectory, { recursive: true, force: true });
});

describe('writeInsight', () => {
  test('appends insight entry to sqlite db', () => {
    writeInsight({ dbPath, sessionId: 'sess-abc', payload, contextFilePath: '/tmp/ctx.md' });

    const log = new SqliteInsightLog(dbPath);
    const entries = log.allEntries();

    expect(entries).toHaveLength(1);
    expect(entries[0]?.summary).toContain('Read');
    expect(entries[0]?.tags).toEqual(['Read']);
    expect(entries[0]?.contextFile).toBe('/tmp/ctx.md');
    expect(entries[0]?.safeToDelete).toBe(false);
  });

  test('truncates tool_response to 500 chars in summary', () => {
    const longPayload = {
      ...payload,
      tool_response: { content: 'x'.repeat(1000) },
    };

    writeInsight({
      dbPath,
      sessionId: 'sess-abc',
      payload: longPayload,
      contextFilePath: '/tmp/ctx.md',
    });

    const log = new SqliteInsightLog(dbPath);
    const entries = log.allEntries();
    const summary = entries[0]?.summary ?? '';
    expect(summary.length).toBeLessThanOrEqual('Read: '.length + 500);
  });
});
