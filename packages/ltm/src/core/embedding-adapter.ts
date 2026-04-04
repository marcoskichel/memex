import type { ResultAsync } from 'neverthrow';

export interface EmbedResult {
  vector: Float32Array;
  modelId: string;
  dimensions: number;
}

export type EmbedError =
  | { type: 'EMBED_API_UNAVAILABLE'; cause: unknown }
  | { type: 'EMBED_DIMENSION_MISMATCH'; expected: number; actual: number }
  | { type: 'EMBED_EMPTY_INPUT' };

export interface EmbeddingMeta {
  modelId: string;
  dimensions: number;
}

export interface EmbeddingAdapter {
  readonly modelId: string;
  readonly dimensions: number;
  embed(text: string): ResultAsync<EmbedResult, EmbedError>;
}
