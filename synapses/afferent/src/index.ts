import { randomUUID } from 'node:crypto';
import { createConnection } from 'node:net';

import { IPC_SOCKET_PATH } from '@neurome/cortex';

interface StageStartEvent {
  type: 'STAGE_START';
  agent: string;
}

interface StageEndEvent {
  type: 'STAGE_END';
  agent: string;
  durationMs: number;
}

interface ThoughtEvent {
  type: 'THOUGHT';
  agent: string;
  text: string;
}

type KnownAgentEvent = StageStartEvent | StageEndEvent | ThoughtEvent;

export type AgentEvent = KnownAgentEvent | { type: string; agent: string };

const KNOWN_TYPES = new Set<string>(['STAGE_START', 'STAGE_END', 'THOUGHT']);

function asKnown(event: AgentEvent): KnownAgentEvent | undefined {
  return KNOWN_TYPES.has(event.type) ? (event as KnownAgentEvent) : undefined;
}

function summaryFor(event: AgentEvent): string {
  const known = asKnown(event);
  if (!known) {
    return `Agent event: ${event.type}`;
  }

  switch (known.type) {
    case 'STAGE_START': {
      return `QA agent started: ${known.agent}`;
    }
    case 'STAGE_END': {
      return `QA agent completed: ${known.agent} in ${known.durationMs.toString()}ms`;
    }
    case 'THOUGHT': {
      return `Agent reasoning: ${known.text}`;
    }
  }
}

function extraTagsFor(event: AgentEvent): string[] {
  const known = asKnown(event);
  if (!known) {
    return [];
  }

  switch (known.type) {
    case 'STAGE_START':
    case 'STAGE_END': {
      return ['lifecycle'];
    }
    case 'THOUGHT': {
      return ['observation'];
    }
  }
}

function buildFrame(event: AgentEvent, runId: string): string {
  const tags = [`agent:${event.agent}`, `run:${runId}`, ...extraTagsFor(event)];
  const payload = { summary: summaryFor(event), contextFile: '', tags };
  return JSON.stringify({ id: randomUUID(), type: 'logInsight', payload }) + '\n';
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
      const frame = buildFrame(event, runId);
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
