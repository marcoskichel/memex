import { describe, expect, it, vi } from 'vitest';

import type { StructuredOutputSchema } from '../llm-adapter.js';
import {
  OpenAICompatibleAdapter,
  type OpenAICompatibleClient,
} from '../openai-compatible-adapter.js';

function makeClient(content: string): [OpenAICompatibleClient, ReturnType<typeof vi.fn>] {
  const createMock = vi.fn().mockResolvedValue({
    choices: [{ message: { content } }],
  });
  const client: OpenAICompatibleClient = {
    chat: {
      completions: {
        create: createMock,
      },
    },
  };
  return [client, createMock];
}

describe('OpenAICompatibleAdapter', () => {
  describe('complete()', () => {
    it('delegates to client.chat.completions.create', async () => {
      const [client, createMock] = makeClient('response text');
      const adapter = new OpenAICompatibleAdapter(client, 'gpt-4o');

      const completed = await adapter.complete('Hello');
      const result = completed._unsafeUnwrap();

      expect(result).toBe('response text');
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      );
    });

    it('includes system message when systemPrompt is provided', async () => {
      const [client, createMock] = makeClient('response');
      const adapter = new OpenAICompatibleAdapter(client, 'gpt-4o');

      await adapter.complete('prompt', { systemPrompt: 'You are helpful' });

      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: 'system', content: 'You are helpful' },
            { role: 'user', content: 'prompt' },
          ],
        }),
      );
    });
  });

  describe('completeStructured()', () => {
    it('appends schema shape to prompt and parses JSON response', async () => {
      const payload = { value: 'result' };
      const [client, createMock] = makeClient(JSON.stringify(payload));
      const adapter = new OpenAICompatibleAdapter(client, 'gpt-4o');

      const parseFunction = vi.fn().mockReturnValue(payload);
      const schema: StructuredOutputSchema<{ value: string }> = {
        name: 'extract_value',
        description: 'Extracts a value',
        shape: { value: { type: 'string' } },
        parse: parseFunction,
      };

      const completed = await adapter.completeStructured({ prompt: 'Extract value', schema });
      const result = completed._unsafeUnwrap();

      expect(result).toEqual(payload);
      expect(parseFunction).toHaveBeenCalledWith(payload);

      const firstCallArguments = createMock.mock.calls[0] as
        | [{ messages: { role: string; content: string }[] }]
        | undefined;
      if (!firstCallArguments) {
        throw new Error('No calls recorded');
      }
      const callArgument = firstCallArguments[0];
      const userMessage = callArgument.messages.find((message) => message.role === 'user');
      if (!userMessage) {
        throw new Error('No user message found');
      }
      expect(userMessage.content).toContain('Extract value');
      expect(userMessage.content).toContain(JSON.stringify(schema.shape, undefined, 2));
    });

    it('propagates parse errors as PARSE_ERROR', async () => {
      const [client] = makeClient(JSON.stringify({ x: 1 }));
      const adapter = new OpenAICompatibleAdapter(client, 'gpt-4o');

      const schema: StructuredOutputSchema<never> = {
        name: 'extract',
        description: 'Extract',
        shape: {},
        parse: () => {
          throw new Error('parse failed');
        },
      };

      const result = await adapter.completeStructured({ prompt: 'prompt', schema });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toMatchObject({ type: 'PARSE_ERROR' });
    });

    it('returns PARSE_ERROR on invalid JSON in response', async () => {
      const [client] = makeClient('not json');
      const adapter = new OpenAICompatibleAdapter(client, 'gpt-4o');

      const schema: StructuredOutputSchema<unknown> = {
        name: 'extract',
        description: 'Extract',
        shape: {},
        parse: (raw) => raw,
      };

      const result = await adapter.completeStructured({ prompt: 'prompt', schema });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toMatchObject({ type: 'PARSE_ERROR' });
    });
  });
});
