import { cosineSimilarity } from './cosine-similarity.js';
import { extractFilters } from './extract-filters.js';
import { NeuralEmbedder, type NeuralEmbedderOptions } from './neural-embedder.js';

export interface EngramRecord {
  id: number;
  data: string;
  metadata: Record<string, unknown>;
  similarity?: number;
}

interface StoredRecord {
  id: number;
  data: string;
  metadata: Record<string, unknown>;
  embedding: Float32Array;
}

export type EngramOptions = NeuralEmbedderOptions;

export class EngramEngine {
  private readonly embedder: NeuralEmbedder;
  private readonly records: Map<number, StoredRecord>;
  private nextId: number;

  constructor(options: EngramOptions = {}) {
    this.embedder = new NeuralEmbedder(options);
    this.records = new Map();
    this.nextId = 1;
  }

  insert(data: string, metadata: Record<string, unknown>): number {
    const id = this.nextId++;
    this.records.set(id, {
      id,
      data,
      metadata,
      embedding: this.embedder.embed(data),
    });
    return id;
  }

  bulkInsert(entries: { data: string; metadata: Record<string, unknown> }[]): number[] {
    return entries.map(({ data, metadata }) => this.insert(data, metadata));
  }

  update(id: number, patch: { data?: string; metadata?: Record<string, unknown> }): boolean {
    const record = this.records.get(id);
    if (record === undefined) {
      return false;
    }

    if (patch.data !== undefined) {
      record.data = patch.data;
      record.embedding = this.embedder.embed(patch.data);
    }
    if (patch.metadata !== undefined) {
      record.metadata = { ...record.metadata, ...patch.metadata };
    }
    return true;
  }

  delete(id: number): boolean {
    return this.records.delete(id);
  }

  query(nlQuery: string, threshold = 0.5): EngramRecord[] {
    const queryEmbedding = this.embedder.embed(nlQuery);
    const filters = extractFilters(nlQuery);

    const candidates: { record: StoredRecord; score: number }[] = [];

    for (const record of this.records.values()) {
      const score = cosineSimilarity(queryEmbedding, record.embedding);
      if (score >= threshold) {
        candidates.push({ record, score });
      }
    }

    candidates.sort((first, second) => second.score - first.score);

    const results: EngramRecord[] = [];

    for (const { record, score } of candidates) {
      if (filters.amountThreshold !== undefined) {
        const amount = record.metadata.amount;
        if (typeof amount !== 'number' || amount <= filters.amountThreshold) {
          continue;
        }
      }

      if (filters.timeRange !== undefined) {
        const timestamp = record.metadata.timestamp;
        if (!(timestamp instanceof Date)) {
          continue;
        }
        if (
          timestamp.getTime() < filters.timeRange.start.getTime() ||
          timestamp.getTime() > filters.timeRange.end.getTime()
        ) {
          continue;
        }
      }

      results.push({
        id: record.id,
        data: record.data,
        metadata: record.metadata,
        similarity: score,
      });
    }

    return results;
  }
}
