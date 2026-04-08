import { spawnSync } from 'node:child_process';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRecall, mockGetContext, mockGetRecent, mockGetStats, mockLogInsight } = vi.hoisted(
  () => ({
    mockRecall: vi.fn().mockResolvedValue([]),
    mockGetContext: vi.fn().mockResolvedValue('ctx'),
    mockGetRecent: vi.fn().mockResolvedValue([]),
    mockGetStats: vi.fn().mockResolvedValue({}),
    mockLogInsight: vi.fn(),
  }),
);

vi.mock('@neurome/axon', () => ({
  AxonClient: vi.fn().mockImplementation(() => ({
    recall: mockRecall,
    getContext: mockGetContext,
    getRecent: mockGetRecent,
    getStats: mockGetStats,
    logInsight: mockLogInsight,
    disconnect: vi.fn(),
  })),
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn(),
}));

import { createServer } from '../server.js';

interface RegisteredTool {
  handler: (arguments_: unknown) => unknown;
  inputSchema: { safeParse: (value: unknown) => { success: boolean } };
}
type RegisteredToolsMap = Record<string, RegisteredTool>;
interface ServerInternal {
  _registeredTools: RegisteredToolsMap;
}

function makeAxonMock() {
  return {
    recall: mockRecall,
    getContext: mockGetContext,
    getRecent: mockGetRecent,
    getStats: mockGetStats,
    logInsight: mockLogInsight,
    disconnect: vi.fn(),
  };
}

function getTools(server: ReturnType<typeof createServer>): RegisteredToolsMap {
  return (server as unknown as ServerInternal)._registeredTools;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('dendrite — tool registration (read-only)', () => {
  it('registers exactly four tools: recall, get_context, get_recent, get_stats', () => {
    const server = createServer(makeAxonMock() as never, {
      engramId: 'test-engram',
      accessMode: 'read-only',
    });
    const toolNames = Object.keys(getTools(server)).toSorted();
    expect(toolNames).toEqual(['get_context', 'get_recent', 'get_stats', 'recall']);
  });

  it('does not register write tools', () => {
    const server = createServer(makeAxonMock() as never, {
      engramId: 'test-engram',
      accessMode: 'read-only',
    });
    const toolNames = Object.keys(getTools(server));
    expect(toolNames).not.toContain('log_insight');
    expect(toolNames).not.toContain('logInsight');
    expect(toolNames).not.toContain('insertMemory');
    expect(toolNames).not.toContain('importText');
    expect(toolNames).not.toContain('consolidate');
  });

  it('does not register log_insight for unrecognized access mode', () => {
    const server = createServer(makeAxonMock() as never, {
      engramId: 'test-engram',
      accessMode: 'unknown-value',
    });
    const toolNames = Object.keys(getTools(server));
    expect(toolNames).not.toContain('log_insight');
  });
});

describe('dendrite — tool registration (full)', () => {
  it('registers five tools including log_insight', () => {
    const server = createServer(makeAxonMock() as never, {
      engramId: 'test-engram',
      accessMode: 'full',
    });
    const toolNames = Object.keys(getTools(server)).toSorted();
    expect(toolNames).toEqual(['get_context', 'get_recent', 'get_stats', 'log_insight', 'recall']);
  });
});

describe('dendrite — log_insight tool', () => {
  it('calls axon.logInsight with summary and empty contextFile', async () => {
    const server = createServer(makeAxonMock() as never, {
      engramId: 'test-engram',
      accessMode: 'full',
    });
    await getTools(server).log_insight?.handler({ insight: 'I know nothing!' });

    expect(mockLogInsight).toHaveBeenCalledWith({ summary: 'I know nothing!', contextFile: '' });
  });

  it('returns { logged: true }', async () => {
    const server = createServer(makeAxonMock() as never, {
      engramId: 'test-engram',
      accessMode: 'full',
    });
    const result = await getTools(server).log_insight?.handler({ insight: 'something' });

    expect(result).toMatchObject({
      content: [{ type: 'text', text: expect.stringContaining('"logged": true') }],
    });
  });

  it('input schema rejects insight strings exceeding 10,000 characters', () => {
    const server = createServer(makeAxonMock() as never, {
      engramId: 'test-engram',
      accessMode: 'full',
    });
    const longInsight = 'x'.repeat(10_001);
    const result = getTools(server).log_insight?.inputSchema.safeParse({ insight: longInsight });
    expect(result?.success).toBe(false);
  });

  it('input schema accepts insight strings at the 10,000 character limit', () => {
    const server = createServer(makeAxonMock() as never, {
      engramId: 'test-engram',
      accessMode: 'full',
    });
    const maxInsight = 'x'.repeat(10_000);
    const result = getTools(server).log_insight?.inputSchema.safeParse({ insight: maxInsight });
    expect(result?.success).toBe(true);
  });
});

describe('dendrite — recall tool', () => {
  it('delegates to axon.recall and returns result', async () => {
    mockRecall.mockResolvedValueOnce([
      { record: { id: 1, tier: 'ltm', data: 'hello', metadata: {} }, effectiveScore: 0.9 },
    ]);

    const server = createServer(makeAxonMock() as never, {
      engramId: 'test-engram',
      accessMode: 'read-only',
    });
    const result = await getTools(server).recall?.handler({ query: 'test query' });

    expect(mockRecall).toHaveBeenCalledWith('test query', {});
    expect(result).toMatchObject({ content: [{ type: 'text' }] });
    expect((result as { isError?: boolean }).isError).toBeUndefined();
  });

  it('returns MCP error on axon failure', async () => {
    mockRecall.mockRejectedValueOnce(new Error('socket timeout'));

    const server = createServer(makeAxonMock() as never, {
      engramId: 'test-engram',
      accessMode: 'read-only',
    });
    const result = await getTools(server).recall?.handler({ query: 'test' });

    expect((result as { isError: boolean }).isError).toBe(true);
  });
});

describe('dendrite — get_context tool', () => {
  it('delegates to axon.getContext with server engram ID', async () => {
    mockGetContext.mockResolvedValueOnce('assembled context');

    const server = createServer(makeAxonMock() as never, {
      engramId: 'my-engram',
      accessMode: 'read-only',
    });
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
    const server = createServer(makeAxonMock() as never, {
      engramId: 'test-engram',
      accessMode: 'read-only',
    });

    await getTools(server).get_recent?.handler({ limit: 5 });

    expect(mockGetRecent).toHaveBeenCalledWith(5);
  });
});

describe('dendrite — get_stats tool', () => {
  it('delegates to axon.getStats', async () => {
    const server = createServer(makeAxonMock() as never, {
      engramId: 'test-engram',
      accessMode: 'read-only',
    });

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
