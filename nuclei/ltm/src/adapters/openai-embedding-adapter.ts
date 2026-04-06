import { errAsync, okAsync, ResultAsync } from 'neverthrow';
import OpenAI from 'openai';

import type { EmbeddingAdapter, EmbedError, EmbedResult } from '../core/embedding-adapter.js';

const OPENAI_MODEL_ID = 'text-embedding-3-small';
const OPENAI_DIMENSIONS = 1536;

export class OpenAIEmbeddingAdapter implements EmbeddingAdapter {
  readonly modelId = OPENAI_MODEL_ID;
  readonly dimensions = OPENAI_DIMENSIONS;
  private client: OpenAI;

  constructor(options: { apiKey: string }) {
    this.client = new OpenAI({ apiKey: options.apiKey });
  }

  embed(text: string): ResultAsync<EmbedResult, EmbedError> {
    if (!text || text.trim().length === 0) {
      return errAsync({ type: 'EMBED_EMPTY_INPUT' as const });
    }

    return ResultAsync.fromPromise(
      this.client.embeddings.create({
        model: this.modelId,
        input: text,
      }),
      (error) => ({ type: 'EMBED_API_UNAVAILABLE' as const, cause: error }),
    ).andThen((response) => {
      const embedding = response.data[0]?.embedding;
      if (!embedding) {
        return errAsync({
          type: 'EMBED_API_UNAVAILABLE' as const,
          cause: 'No embedding returned',
        });
      }
      const vector = new Float32Array(embedding);
      if (vector.length !== this.dimensions) {
        return errAsync({
          type: 'EMBED_DIMENSION_MISMATCH' as const,
          expected: this.dimensions,
          actual: vector.length,
        });
      }
      return okAsync({
        vector,
        modelId: this.modelId,
        dimensions: this.dimensions,
      });
    });
  }
}
