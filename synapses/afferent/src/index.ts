import { randomUUID } from 'node:crypto';
import { createConnection } from 'node:net';

import { IPC_SOCKET_PATH } from '@memex/cortex';

export interface AgentEvent {
  type: string;
  agent: string;
  [key: string]: unknown;
}

const MAX_RESULT_LENGTH = 500;

function summaryFor(event: AgentEvent): string {
  switch (event.type) {
    case 'STAGE_START': {
      return `QA agent started: ${event.agent}`;
    }
    case 'STAGE_END': {
      return `QA agent completed: ${event.agent} in ${String(event.durationMs)}ms`;
    }
    case 'THOUGHT': {
      return `Agent reasoning: ${String(event.text)}`;
    }
    case 'TOOL_CALL': {
      return `Tool called: ${String(event.toolName)} — ${JSON.stringify(event.input)}`;
    }
    case 'TOOL_RESULT': {
      return `Tool result (${String(event.toolName)}): ${String(event.result).slice(0, MAX_RESULT_LENGTH)}`;
    }
    default: {
      return `Agent event: ${event.type}`;
    }
  }
}

function extraTagsFor(event: AgentEvent): string[] {
  switch (event.type) {
    case 'STAGE_START':
    case 'STAGE_END': {
      return ['lifecycle'];
    }
    case 'THOUGHT': {
      return ['observation'];
    }
    case 'TOOL_CALL': {
      return ['navigation', `tool:${String(event.toolName)}`];
    }
    case 'TOOL_RESULT': {
      return ['screen-state', `tool:${String(event.toolName)}`];
    }
    default: {
      return [];
    }
  }
}

function buildFrame(event: AgentEvent, runId: string): string {
  const tags = [`agent:${event.agent}`, `run:${runId}`, ...extraTagsFor(event)];
  const payload = { summary: summaryFor(event), contextFile: '', tags };
  return JSON.stringify({ id: randomUUID(), type: 'logInsight', payload }) + '\n';
}

export function createAfferent(sessionId: string): (event: AgentEvent) => void {
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

  return (event: AgentEvent) => {
    const frame = buildFrame(event, runId);
    if (connected) {
      socket.write(frame);
    } else {
      queue.push(frame);
    }
  };
}
