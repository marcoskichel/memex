import type { LLMAdapter } from '@memex/llm';
import type { LtmEngine } from '@memex/ltm';
import { ResultAsync } from 'neverthrow';

import { ImportTextError } from './memory-types.js';

function noop() {
  return;
}

const EXTRACT_PROMPT = (text: string) =>
  `Extract discrete, self-contained facts or memories from the following text. Each memory should be a single sentence or short paragraph that stands on its own without context from the other memories.\n\nText:\n${text}`;

const MEMORIES_SCHEMA = {
  name: 'memories',
  description: 'A list of discrete memory strings extracted from the input text',
  shape: {
    type: 'object' as const,
    properties: { memories: { type: 'array' as const, items: { type: 'string' as const } } },
    required: ['memories'],
  },
  parse: (raw: unknown): string[] => {
    const object = raw as { memories: string[] };
    return object.memories.filter((item) => typeof item === 'string' && item.trim().length > 0);
  },
};

async function bulkInsert(ltm: LtmEngine, items: string[]): Promise<{ inserted: number }> {
  let inserted = 0;
  for (const item of items) {
    const insertResult = await ltm.insert(item);
    insertResult.match(() => {
      inserted++;
    }, noop);
  }
  return { inserted };
}

export interface ImportTextDeps {
  llmAdapter: LLMAdapter;
  ltm: LtmEngine;
}

export function importTextImpl(
  deps: ImportTextDeps,
  text: string,
): ResultAsync<{ inserted: number }, ImportTextError> {
  return deps.llmAdapter
    .completeStructured({ prompt: EXTRACT_PROMPT(text), schema: MEMORIES_SCHEMA })
    .mapErr((error) => new ImportTextError(error.type))
    .andThen((items) => ResultAsync.fromSafePromise(bulkInsert(deps.ltm, items)));
}
