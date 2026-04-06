import { createConnection } from 'node:net';

import type { GetContextPayload, LogInsightPayload } from '@neurome/cortex-ipc';
import { IPC_SOCKET_PATH } from '@neurome/cortex-ipc';

const LOG_INSIGHT_TIMEOUT_MS = 50;
const GET_CONTEXT_TIMEOUT_MS = 200;

function buildRequest(type: string, payload: unknown): string {
  return JSON.stringify({ id: '1', type, payload }) + '\n';
}

export async function sendLogInsight(payload: LogInsightPayload, sessionId: string): Promise<void> {
  await withSocketTimeout({
    timeoutMs: LOG_INSIGHT_TIMEOUT_MS,
    sessionId,
    task: (socket) => {
      socket.write(buildRequest('logInsight', payload));
      return Promise.resolve();
    },
  });
}

export async function getContext(payload: GetContextPayload, sessionId: string): Promise<string> {
  let result = '';
  await withSocketTimeout({
    timeoutMs: GET_CONTEXT_TIMEOUT_MS,
    sessionId,
    task: (socket) => {
      return new Promise<void>((resolve) => {
        let buffer = '';
        socket.on('data', (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.at(-1) ?? '';
          for (const line of lines.slice(0, -1)) {
            if (line.trim()) {
              try {
                const response = JSON.parse(line) as { ok: boolean; result?: string };
                if (response.ok && typeof response.result === 'string') {
                  result = response.result;
                }
              } catch {}
              resolve();
              return;
            }
          }
        });
        socket.write(buildRequest('getContext', payload));
      });
    },
  });
  return result;
}

interface SocketTask {
  timeoutMs: number;
  sessionId: string;
  task: (socket: ReturnType<typeof createConnection>) => Promise<void>;
}

async function withSocketTimeout({ timeoutMs, sessionId, task }: SocketTask): Promise<void> {
  const socketPath = IPC_SOCKET_PATH(sessionId);
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);

    const socket = createConnection(socketPath);

    const cleanup = () => {
      clearTimeout(timer);
      socket.destroy();
      resolve();
    };

    socket.once('connect', () => {
      task(socket).then(cleanup).catch(cleanup);
    });

    socket.once('error', cleanup);
    socket.once('close', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}
