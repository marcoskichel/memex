import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockLogInsight, MockAxonClient } = vi.hoisted(() => {
  const mockLogInsight = vi.fn();
  const MockAxonClient = vi.fn(() => ({
    logInsight: mockLogInsight,
  }));
  return { mockLogInsight, MockAxonClient };
});

vi.mock('@neurome/axon', () => ({
  AxonClient: MockAxonClient,
}));

const mockReadFileSync = vi.fn(() =>
  JSON.stringify({
    session_id: 'sess-abc',
    tool_name: 'Read',
    tool_input: { file_path: '/foo/bar.ts' },
    tool_response: { content: 'hello' },
  }),
);

vi.mock('node:fs', () => ({
  readFileSync: mockReadFileSync,
}));

const mockExit = vi.spyOn(process, 'exit').mockImplementation((_code) => {
  throw new Error(`process.exit(${String(_code)})`);
});

beforeEach(() => {
  vi.resetModules();
  mockLogInsight.mockReset();
  mockExit.mockClear();
  mockReadFileSync.mockImplementation(() =>
    JSON.stringify({
      session_id: 'sess-abc',
      tool_name: 'Read',
      tool_input: { file_path: '/foo/bar.ts' },
      tool_response: { content: 'hello' },
    }),
  );
  delete process.env.MEMORY_SESSION_ID;
});

describe('post-tool-use', () => {
  it('calls logInsight and exits 0 on successful call', async () => {
    await expect(import('../bin/post-tool-use.js')).rejects.toThrow('process.exit(0)');

    expect(mockLogInsight).toHaveBeenCalledOnce();
    expect(mockExit).toHaveBeenCalledWith(0);
  });

  it('exits 0 when no session ID is available', async () => {
    mockReadFileSync.mockImplementation(() =>
      JSON.stringify({
        tool_name: 'Read',
        tool_input: { file_path: '/foo/bar.ts' },
        tool_response: { content: 'hello' },
      }),
    );

    await expect(import('../bin/post-tool-use.js')).rejects.toThrow('process.exit(0)');

    expect(mockLogInsight).not.toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(0);
  });

  it('exits 0 when axon.logInsight throws', async () => {
    mockLogInsight.mockImplementation(() => {
      throw new Error('socket error');
    });

    await expect(import('../bin/post-tool-use.js')).rejects.toThrow('process.exit(0)');

    expect(mockExit).toHaveBeenCalledWith(0);
  });
});
