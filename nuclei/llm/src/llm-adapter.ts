import type { ResultAsync } from 'neverthrow';

export type LLMError =
  | { type: 'UNEXPECTED_RESPONSE' }
  | { type: 'NO_CONTENT' }
  | { type: 'PARSE_ERROR'; cause: unknown };

export interface LLMRequestOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface StructuredOutputSchema<T> {
  name: string;
  description: string;
  shape: Record<string, unknown>;
  parse: (raw: unknown) => T;
}

export interface StructuredRequest<T> {
  prompt: string;
  schema: StructuredOutputSchema<T>;
  options?: LLMRequestOptions;
}

export interface LLMAdapter {
  complete(prompt: string, options?: LLMRequestOptions): ResultAsync<string, LLMError>;
  completeStructured<T>(request: StructuredRequest<T>): ResultAsync<T, LLMError>;
}
