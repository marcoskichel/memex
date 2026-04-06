import { randomUUID } from 'node:crypto';
import { createConnection } from 'node:net';

import { IPC_SOCKET_PATH } from '@neurome/cortex-ipc';

export interface AgentEvent {
  agent: string;
  text: string;
}

const MAX_QUEUE_SIZE = 1000;

export interface Afferent {
  emit(event: AgentEvent): void;
  disconnect(): void;
}

export function createAfferent(sessionId: string): Afferent {
  const runId = randomUUID();
  const socket = createConnection(IPC_SOCKET_PATH(sessionId));
  let connected = false;
  const queue: string[] = [];

  socket.once('connect', () => {
    connected = true;
    for (const frame of queue) {
      socket.write(frame);
    }
    queue.length = 0;
  });

  socket.on('error', () => {
    connected = false;
  });

  return {
    emit(event: AgentEvent) {
      const tags = [`agent:${event.agent}`, `run:${runId}`, 'observation'];
      const payload = { summary: event.text, contextFile: '', tags };
      const frame = JSON.stringify({ id: randomUUID(), type: 'logInsight', payload }) + '\n';
      if (connected) {
        socket.write(frame);
      } else if (queue.length < MAX_QUEUE_SIZE) {
        queue.push(frame);
      }
    },
    disconnect() {
      socket.destroy();
      queue.length = 0;
      connected = false;
    },
  };
}
