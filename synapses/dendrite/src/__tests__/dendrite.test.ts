import { spawnSync } from 'node:child_process';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRecall, mockGetContext, mockGetRecent, mockGetStats } = vi.hoisted(() => ({
  mockRecall: vi.fn().mockResolvedValue([]),
  mockGetContext: vi.fn().mockResolvedValue('ctx'),
  mockGetRecent: vi.fn().mockResolvedValue([]),
  mockGetStats: vi.fn().mockResolvedValue({}),
}));

vi.mock('@neurome/axon', () => ({
  AxonClient: vi.fn().mockImplementation(() => ({
    recall: mockRecall,
    getContext: mockGetContext,
    getRecent: mockGetRecent,
    getStats: mockGetStats,
    disconnect: vi.fn(),
  })),
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn(),
}));

import { createServer } from '../server.js';

type RegisteredToolsMap = Record<string, { handler: (arguments_: unknown) => Promise<unknown> }>;
interface ServerInternal {
  _registeredTools: RegisteredToolsMap;
}

function makeAxonMock() {
  return {
    recall: mockRecall,
    getContext: mockGetContext,
    getRecent: mockGetRecent,
    getStats: mockGetStats,
    disconnect: vi.fn(),
  };
}

function getTools(server: ReturnType<typeof createServer>): RegisteredToolsMap {
  return (server as unknown as ServerInternal)._registeredTools;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('dendrite — tool registration', () => {
  it('registers exactly four tools: recall, get_context, get_recent, get_stats', () => {
    const server = createServer(makeAxonMock() as never, 'test-engram');
    const toolNames = Object.keys(getTools(server)).toSorted();
    expect(toolNames).toEqual(['get_context', 'get_recent', 'get_stats', 'recall']);
  });

  it('does not register write tools', () => {
    const server = createServer(makeAxonMock() as never, 'test-engram');
    const toolNames = Object.keys(getTools(server));
    expect(toolNames).not.toContain('logInsight');
    expect(toolNames).not.toContain('insertMemory');
    expect(toolNames).not.toContain('importText');
    expect(toolNames).not.toContain('consolidate');
  });
});

describe('dendrite — recall tool', () => {
  it('delegates to axon.recall and returns result', async () => {
    mockRecall.mockResolvedValueOnce([
      { record: { id: 1, tier: 'ltm', data: 'hello', metadata: {} }, effectiveScore: 0.9 },
    ]);

    const server = createServer(makeAxonMock() as never, 'test-engram');
    const result = await getTools(server).recall?.handler({ query: 'test query' });

    expect(mockRecall).toHaveBeenCalledWith('test query', {});
    expect(result).toMatchObject({ content: [{ type: 'text' }] });
    expect((result as { isError?: boolean }).isError).toBeUndefined();
  });

  it('returns MCP error on axon failure', async () => {
    mockRecall.mockRejectedValueOnce(new Error('socket timeout'));

    const server = createServer(makeAxonMock() as never, 'test-engram');
    const result = await getTools(server).recall?.handler({ query: 'test' });

    expect((result as { isError: boolean }).isError).toBe(true);
  });
});

describe('dendrite — get_context tool', () => {
  it('delegates to axon.getContext with server engram ID', async () => {
    mockGetContext.mockResolvedValueOnce('assembled context');

    const server = createServer(makeAxonMock() as never, 'my-engram');
    await getTools(server).get_context?.handler({
      tool_name: 'Read',
      tool_input: { path: '/foo' },
    });

    expect(mockGetContext).toHaveBeenCalledWith(
      expect.objectContaining({ engramId: 'my-engram', toolName: 'Read' }),
    );
  });
});

describe('dendrite — get_recent tool', () => {
  it('delegates to axon.getRecent', async () => {
    const server = createServer(makeAxonMock() as never, 'test-engram');

    await getTools(server).get_recent?.handler({ limit: 5 });

    expect(mockGetRecent).toHaveBeenCalledWith(5);
  });
});

describe('dendrite — get_stats tool', () => {
  it('delegates to axon.getStats', async () => {
    const server = createServer(makeAxonMock() as never, 'test-engram');

    await getTools(server).get_stats?.handler({});

    expect(mockGetStats).toHaveBeenCalled();
  });
});

describe('dendrite — missing NEUROME_ENGRAM_ID', () => {
  it('exits non-zero and names the missing variable', () => {
    const env = { ...process.env };
    delete env.NEUROME_ENGRAM_ID;
    const result = spawnSync(
      'node',
      [
        '--input-type=module',
        '--eval',
        [
          'const id = process.env.NEUROME_ENGRAM_ID;',
          String.raw`if (!id) { process.stderr.write('NEUROME_ENGRAM_ID\n'); process.exit(1); }`,
        ].join('\n'),
      ],
      { env, encoding: 'utf8' },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('NEUROME_ENGRAM_ID');
  });
});
