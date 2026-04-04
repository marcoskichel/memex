import { okAsync, type ResultAsync } from 'neverthrow';

import type { EmbeddingAdapter, EmbedError } from '../core/embedding-adapter.js';
import type { LtmRecord, StorageAdapter } from '../storage/storage-adapter.js';

export type ReembedError = EmbedError;

interface ReembedState {
  adapter: EmbeddingAdapter;
  storage: StorageAdapter;
  records: LtmRecord[];
  index: number;
  reembedded: number;
}

function reembedSequential(state: ReembedState): ResultAsync<{ reembedded: number }, ReembedError> {
  const { adapter, storage, records, index, reembedded } = state;
  if (index >= records.length) {
    return okAsync({ reembedded });
  }
  const record = records[index];
  if (!record) {
    return okAsync({ reembedded });
  }
  return adapter.embed(record.data).andThen((result) => {
    storage.updateEmbedding(record.id, {
      embedding: result.vector,
      meta: { modelId: result.modelId, dimensions: result.dimensions },
    });
    return reembedSequential({
      adapter,
      storage,
      records,
      index: index + 1,
      reembedded: reembedded + 1,
    });
  });
}

export function reembedAll(
  adapter: EmbeddingAdapter,
  storage: StorageAdapter,
): ResultAsync<{ reembedded: number }, ReembedError> {
  const records = storage.getAllRecords();
  if (records.length === 0) {
    return okAsync({ reembedded: 0 });
  }
  return reembedSequential({ adapter, storage, records, index: 0, reembedded: 0 });
}
