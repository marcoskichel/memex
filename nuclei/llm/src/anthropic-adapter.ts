import Anthropic from '@anthropic-ai/sdk';
import { errAsync, fromThrowable, okAsync, ResultAsync } from 'neverthrow';

import type { LLMAdapter, LLMError, LLMRequestOptions, StructuredRequest } from './llm-adapter.js';

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const DEFAULT_MAX_TOKENS = 1024;

export class AnthropicAdapter implements LLMAdapter {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(apiKey: string, model: string = DEFAULT_MODEL) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  complete(prompt: string, options?: LLMRequestOptions): ResultAsync<string, LLMError> {
    return ResultAsync.fromPromise(
      this.client.messages.create({
        model: this.model,
        max_tokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
        ...(options?.temperature !== undefined && { temperature: options.temperature }),
        ...(options?.systemPrompt && { system: options.systemPrompt }),
        messages: [{ role: 'user', content: prompt }],
      }),
      (): LLMError => ({ type: 'UNEXPECTED_RESPONSE' }),
    ).andThen((response) => {
      const block = response.content[0];
      if (block?.type !== 'text') {
        return errAsync({ type: 'UNEXPECTED_RESPONSE' } as LLMError);
      }
      return okAsync(block.text);
    });
  }

  completeStructured<T>(request: StructuredRequest<T>): ResultAsync<T, LLMError> {
    const { prompt, schema, options } = request;
    return ResultAsync.fromPromise(
      this.client.messages.create({
        model: this.model,
        max_tokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
        ...(options?.temperature !== undefined && { temperature: options.temperature }),
        ...(options?.systemPrompt && { system: options.systemPrompt }),
        messages: [{ role: 'user', content: prompt }],
        tools: [
          {
            name: schema.name,
            description: schema.description,
            input_schema: {
              type: 'object' as const,
              properties: schema.shape,
            },
          },
        ],
        tool_choice: { type: 'tool' as const, name: schema.name },
      }),
      (): LLMError => ({ type: 'UNEXPECTED_RESPONSE' }),
    ).andThen((response) => {
      const toolBlock = response.content.find((block) => block.type === 'tool_use');
      if (!toolBlock) {
        return errAsync({ type: 'NO_CONTENT' } as LLMError);
      }
      const parseResult = fromThrowable(
        () => schema.parse(toolBlock.input),
        (cause): LLMError => ({ type: 'PARSE_ERROR', cause }),
      )();
      return parseResult.match(
        (value) => okAsync(value),
        (error) => errAsync(error),
      );
    });
  }
}
