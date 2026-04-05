import type { Memory, MemoryEvents } from '@memex/memory';

const VALID_SESSION_ID = /^[\da-z][\w-]{0,127}$/i;

export function IPC_SOCKET_PATH(sessionId: string): string {
  if (!VALID_SESSION_ID.test(sessionId)) {
    throw new Error(`Invalid sessionId: ${sessionId}`);
  }
  return `/tmp/memex-${sessionId}.sock`;
}

export type LogInsightPayload = Parameters<Memory['logInsight']>[0];
export type RecallOptions = Parameters<Memory['recall']>[1];

export interface GetContextPayload {
  sessionId: string;
  toolName: string;
  toolInput: unknown;
}

export interface RecallPayload {
  query: string;
  options?: RecallOptions;
}

export type GetStatsPayload = Record<string, never>;

interface RequestPayloadMap {
  logInsight: LogInsightPayload;
  getContext: GetContextPayload;
  recall: RecallPayload;
  getStats: GetStatsPayload;
}

export type RequestType = keyof RequestPayloadMap;

export type RequestMessage = {
  [K in RequestType]: { id: string; type: K; payload: RequestPayloadMap[K] };
}[RequestType];

export type ResponseMessage =
  | { id: string; ok: true; result: unknown }
  | { id: string; ok: false; error: string };

export type MemoryEventName = keyof MemoryEvents;

export interface PushMessage {
  type: 'event';
  name: MemoryEventName;
  payload: unknown;
}
