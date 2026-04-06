import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetContext, MockAxonClient } = vi.hoisted(() => {
  const mockGetContext = vi.fn();
  const MockAxonClient = vi.fn(() => ({
    getContext: mockGetContext,
    logInsight: vi.fn(),
  }));
  return { mockGetContext, MockAxonClient };
});

vi.mock('@neurome/axon', () => ({
  AxonClient: MockAxonClient,
}));

const mockReadFileSync = vi.fn(() =>
  JSON.stringify({
    session_id: 'sess-abc',
    tool_name: 'Read',
    tool_input: { file_path: '/foo/bar.ts' },
  }),
);

vi.mock('node:fs', () => ({
  readFileSync: mockReadFileSync,
}));

const mockExit = vi.spyOn(process, 'exit').mockImplementation((_code) => {
  throw new Error(`process.exit(${String(_code)})`);
});

const mockStdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

beforeEach(() => {
  vi.resetModules();
  mockGetContext.mockReset();
  mockExit.mockClear();
  mockStdoutWrite.mockClear();
  mockReadFileSync.mockImplementation(() =>
    JSON.stringify({
      session_id: 'sess-abc',
      tool_name: 'Read',
      tool_input: { file_path: '/foo/bar.ts' },
    }),
  );
  delete process.env.MEMORY_SESSION_ID;
  delete process.env.MEMORY_AGENT_NAME;
});

describe('pre-tool-use', () => {
  it('exits 0 with context written to stdout on successful call', async () => {
    mockGetContext.mockResolvedValue('relevant context');

    await expect(import('../bin/pre-tool-use.js')).rejects.toThrow('process.exit(0)');

    expect(mockStdoutWrite).toHaveBeenCalledWith('relevant context');
    expect(mockExit).toHaveBeenCalledWith(0);
  });

  it('exits 0 when no session ID is available', async () => {
    mockReadFileSync.mockImplementation(() =>
      JSON.stringify({
        tool_name: 'Read',
        tool_input: { file_path: '/foo/bar.ts' },
      }),
    );

    await expect(import('../bin/pre-tool-use.js')).rejects.toThrow('process.exit(0)');

    expect(mockGetContext).not.toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(0);
  });

  it('exits 0 when axon.getContext throws (timeout or error)', async () => {
    mockGetContext.mockRejectedValue(new Error('Request timed out after 200ms'));

    await expect(import('../bin/pre-tool-use.js')).rejects.toThrow('process.exit(0)');

    expect(mockExit).toHaveBeenCalledWith(0);
  });

  it('writes nothing to stdout when context is empty', async () => {
    mockGetContext.mockResolvedValue('');

    await expect(import('../bin/pre-tool-use.js')).rejects.toThrow('process.exit(0)');

    expect(mockStdoutWrite).not.toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(0);
  });
});
