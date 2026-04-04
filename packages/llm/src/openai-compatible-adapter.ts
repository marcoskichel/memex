import { errAsync, fromThrowable, okAsync, ResultAsync } from 'neverthrow';

import type { LLMAdapter, LLMError, LLMRequestOptions, StructuredRequest } from './llm-adapter.js';

export interface OpenAICompatibleClient {
  chat: {
    completions: {
      create(params: unknown): Promise<{
        choices: { message: { content: string | undefined } }[];
      }>;
    };
  };
}

export class OpenAICompatibleAdapter implements LLMAdapter {
  private readonly client: OpenAICompatibleClient;
  private readonly model: string;

  constructor(client: OpenAICompatibleClient, model: string) {
    this.client = client;
    this.model = model;
  }

  complete(prompt: string, options?: LLMRequestOptions): ResultAsync<string, LLMError> {
    const messages: { role: string; content: string }[] = [];

    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    return ResultAsync.fromPromise(
      this.client.chat.completions.create({
        model: this.model,
        messages,
        ...(options?.maxTokens !== undefined && { max_tokens: options.maxTokens }),
        ...(options?.temperature !== undefined && { temperature: options.temperature }),
      }),
      (): LLMError => ({ type: 'UNEXPECTED_RESPONSE' }),
    ).andThen((response) => {
      const content = response.choices[0]?.message.content;
      if (!content) {
        return errAsync({ type: 'NO_CONTENT' } as LLMError);
      }
      return okAsync(content);
    });
  }

  completeStructured<T>(request: StructuredRequest<T>): ResultAsync<T, LLMError> {
    const { prompt, schema, options } = request;
    const schemaPrompt = `${prompt}\n\nRespond with a JSON object matching this schema:\n${JSON.stringify(schema.shape, undefined, 2)}`;
    return this.complete(schemaPrompt, options).andThen((response) => {
      const parseJson = fromThrowable(
        () => JSON.parse(response) as unknown,
        (cause): LLMError => ({ type: 'PARSE_ERROR', cause }),
      );
      const jsonResult = parseJson();
      return jsonResult.match(
        (parsed) => {
          const parseSchema = fromThrowable(
            () => schema.parse(parsed),
            (cause): LLMError => ({ type: 'PARSE_ERROR', cause }),
          );
          return parseSchema().match(
            (value) => okAsync(value),
            (error) => errAsync(error),
          );
        },
        (error) => errAsync(error),
      );
    });
  }
}
