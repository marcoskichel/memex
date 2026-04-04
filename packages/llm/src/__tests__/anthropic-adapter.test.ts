import { describe, expect, it, vi } from 'vitest';

import { AnthropicAdapter } from '../anthropic-adapter.js';
import type { StructuredOutputSchema } from '../llm-adapter.js';

const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: mockCreate,
      },
    })),
  };
});

describe('AnthropicAdapter', () => {
  describe('complete()', () => {
    it('sends correct message format', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Hello back' }],
      });

      const adapter = new AnthropicAdapter('test-key');
      const completed = await adapter.complete('Hello');
      const result = completed._unsafeUnwrap();

      expect(result).toBe('Hello back');
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      );
    });

    it('includes system prompt when provided', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'response' }],
      });

      const adapter = new AnthropicAdapter('test-key');
      await adapter.complete('prompt', { systemPrompt: 'You are X' });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'You are X',
          messages: [{ role: 'user', content: 'prompt' }],
        }),
      );
    });

    it('uses claude-haiku-3-5 as default model', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'response' }],
      });

      const adapter = new AnthropicAdapter('test-key');
      await adapter.complete('prompt');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'claude-haiku-3-5' }),
      );
    });

    it('uses provided model', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'response' }],
      });

      const adapter = new AnthropicAdapter('test-key', 'claude-opus-4-5');
      await adapter.complete('prompt');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'claude-opus-4-5' }),
      );
    });
  });

  describe('completeStructured()', () => {
    it('uses tool_use with correct tool_choice', async () => {
      const schema: StructuredOutputSchema<{ name: string }> = {
        name: 'extract_name',
        description: 'Extracts a name',
        shape: { name: { type: 'string' } },
        parse: (raw) => raw as { name: string },
      };

      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'tool_use',
            id: 'tool_1',
            name: 'extract_name',
            input: { name: 'Alice' },
          },
        ],
      });

      const adapter = new AnthropicAdapter('test-key');
      const completed = await adapter.completeStructured({ prompt: 'Extract name', schema });
      const result = completed._unsafeUnwrap();

      expect(result).toEqual({ name: 'Alice' });
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: [
            expect.objectContaining({
              name: 'extract_name',
              description: 'Extracts a name',
              input_schema: {
                type: 'object',
                properties: { name: { type: 'string' } },
              },
            }),
          ],
          tool_choice: { type: 'tool', name: 'extract_name' },
        }),
      );
    });

    it('calls schema.parse with tool input', async () => {
      const parseFunction = vi.fn().mockReturnValue({ count: 42 });
      const schema: StructuredOutputSchema<{ count: number }> = {
        name: 'extract_count',
        description: 'Extracts count',
        shape: { count: { type: 'number' } },
        parse: parseFunction,
      };

      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'tool_use',
            id: 'tool_1',
            name: 'extract_count',
            input: { count: 42 },
          },
        ],
      });

      const adapter = new AnthropicAdapter('test-key');
      await adapter.completeStructured({ prompt: 'Extract count', schema });

      expect(parseFunction).toHaveBeenCalledWith({ count: 42 });
    });

    it('propagates parse errors as PARSE_ERROR', async () => {
      const schema: StructuredOutputSchema<never> = {
        name: 'extract',
        description: 'Extract',
        shape: {},
        parse: () => {
          throw new Error('parse failed');
        },
      };

      mockCreate.mockResolvedValue({
        content: [{ type: 'tool_use', id: 'tool_1', name: 'extract', input: {} }],
      });

      const adapter = new AnthropicAdapter('test-key');
      const result = await adapter.completeStructured({ prompt: 'prompt', schema });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toMatchObject({ type: 'PARSE_ERROR' });
    });
  });
});
