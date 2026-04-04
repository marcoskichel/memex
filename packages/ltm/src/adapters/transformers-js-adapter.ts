import { errAsync, okAsync, ResultAsync } from 'neverthrow';

import type { EmbeddingAdapter, EmbedError, EmbedResult } from '../core/embedding-adapter.js';

const TRANSFORMERS_MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
const TRANSFORMERS_DIMENSIONS = 384;

export class TransformersJsAdapter implements EmbeddingAdapter {
  readonly modelId = TRANSFORMERS_MODEL_ID;
  readonly dimensions = TRANSFORMERS_DIMENSIONS;
  private pipeline: unknown = undefined;

  embed(text: string): ResultAsync<EmbedResult, EmbedError> {
    if (!text || text.trim().length === 0) {
      return errAsync({ type: 'EMBED_EMPTY_INPUT' as const });
    }

    return ResultAsync.fromPromise(this.getOrCreatePipeline(), (error) => ({
      type: 'EMBED_API_UNAVAILABLE' as const,
      cause: error,
    })).andThen((pipe) =>
      ResultAsync.fromPromise(
        (pipe as (input: string, options: Record<string, unknown>) => Promise<unknown>)(text, {
          pooling: 'mean',
          normalize: true,
        }),
        (error) => ({ type: 'EMBED_API_UNAVAILABLE' as const, cause: error }),
      ).andThen((output) => {
        const data = (output as { data: Float32Array }).data;
        const vector = new Float32Array(data);
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
      }),
    );
  }

  private async getOrCreatePipeline(): Promise<unknown> {
    if (this.pipeline) {
      return this.pipeline;
    }
    const { pipeline } = await import('@xenova/transformers');
    this.pipeline = await pipeline('feature-extraction', this.modelId);
    return this.pipeline;
  }
}
