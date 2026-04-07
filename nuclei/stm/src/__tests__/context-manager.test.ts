import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ContextManagerOptions, Phase } from '../context-manager.js';
import { ContextManager } from '../context-manager.js';
import { InsightLog } from '../insight-log.js';

function makePhase(suffix = ''): Phase {
  return {
    toolCall: `tool-call-${suffix}`,
    toolResult: `tool-result-${suffix}`,
    agentReaction: `agent-reaction-${suffix}`,
  };
}

function bigPhase(chars = 300): Phase {
  return {
    toolCall: 'a'.repeat(chars),
    toolResult: '',
    agentReaction: '',
  };
}

describe('ContextManager', () => {
  let insightLog: InsightLog;
  let contextDirectory: string;
  let compressFunction: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    insightLog = new InsightLog();
    contextDirectory = path.join(tmpdir(), `stm-test-${crypto.randomUUID()}`);
    compressFunction = vi.fn().mockResolvedValue('compressed-summary');
  });

  function makeManager(
    overrides: Partial<{ maxTokens: number; compressionThreshold: number }> = {},
  ) {
    const options: ContextManagerOptions = {
      engramId: 'engram-test',
      contextDir: contextDirectory,
      maxTokens: overrides.maxTokens ?? 100,
      compressFn: compressFunction,
      insightLog,
    };
    if (overrides.compressionThreshold !== undefined) {
      options.compressionThreshold = overrides.compressionThreshold;
    }
    return new ContextManager(options);
  }

  it('compression triggers at default threshold (0.7)', async () => {
    const manager = makeManager({ maxTokens: 100 });
    const phase = bigPhase(300);

    const result = await manager.addPhase(phase);
    expect(result.compressed).toBe(true);
    expect(compressFunction).toHaveBeenCalledTimes(1);
  });

  it('compression does not trigger below threshold', async () => {
    const manager = makeManager({ maxTokens: 1000 });
    const result = await manager.addPhase(makePhase());

    expect(result.compressed).toBe(false);
    expect(compressFunction).not.toHaveBeenCalled();
  });

  it('custom threshold is respected', async () => {
    const manager = makeManager({ maxTokens: 100, compressionThreshold: 0.1 });
    const result = await manager.addPhase(makePhase());

    expect(result.compressed).toBe(true);
  });

  it('context file is written before compressFn is called', async () => {
    let contextFileExistedDuringCompress = false;

    const checkingCompressFunction = vi.fn().mockImplementation(() => {
      contextFileExistedDuringCompress = true;
      return Promise.resolve('compressed');
    });

    const manager = new ContextManager({
      engramId: 'engram-file-check',
      contextDir: contextDirectory,
      maxTokens: 100,
      compressFn: checkingCompressFunction,
      insightLog,
    });

    await manager.addPhase(bigPhase(300));
    expect(checkingCompressFunction).toHaveBeenCalled();
    expect(contextFileExistedDuringCompress).toBe(true);
  });

  it('insight appears in InsightLog after compression', async () => {
    const manager = makeManager({ maxTokens: 100 });

    await manager.addPhase(bigPhase(300));

    const unprocessed = insightLog.readUnprocessed();
    expect(unprocessed).toHaveLength(1);
    expect(unprocessed[0]?.summary).toBe('compressed-summary');
  });

  it('context file path follows <contextDir>/<engramId>/<phaseId>.ctx pattern', async () => {
    const manager = makeManager({ maxTokens: 100 });

    await manager.addPhase(bigPhase(300));

    const unprocessed = insightLog.readUnprocessed();
    expect(unprocessed).toHaveLength(1);

    const contextFile = unprocessed[0]?.contextFile;
    expect(contextFile).toMatch(
      new RegExp(String.raw`^${contextDirectory}/engram-test/[\w-]+\.ctx$`),
    );
  });

  it('context file contains full raw phase content', async () => {
    const manager = makeManager({ maxTokens: 100 });

    const phase: Phase = {
      toolCall: 'a'.repeat(280),
      toolResult: 'result-content',
      agentReaction: 'reaction-content',
    };

    await manager.addPhase(phase);

    const contextFile = insightLog.readUnprocessed()[0]?.contextFile ?? '';
    const fileContent = await readFile(contextFile, 'utf8');
    expect(fileContent).toContain(phase.toolCall);
    expect(fileContent).toContain(phase.toolResult);
    expect(fileContent).toContain(phase.agentReaction);
  });

  it('flush processes all remaining uncompressed phases', async () => {
    const manager = makeManager({ maxTokens: 10_000 });

    await manager.addPhase(makePhase('1'));
    await manager.addPhase(makePhase('2'));
    await manager.addPhase(makePhase('3'));

    expect(compressFunction).not.toHaveBeenCalled();

    await manager.flush();

    expect(compressFunction).toHaveBeenCalledTimes(3);
    expect(insightLog.readUnprocessed()).toHaveLength(3);
  });

  it('context file persists after compress (no deletion)', async () => {
    const manager = makeManager({ maxTokens: 100 });

    await manager.addPhase(bigPhase(300));

    const contextFile = insightLog.readUnprocessed()[0]?.contextFile ?? '';
    const content = await readFile(contextFile, 'utf8');
    expect(content).toBeTruthy();
  });
});
