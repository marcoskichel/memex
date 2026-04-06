import type {
  LtmEdge,
  LtmRecord,
  StorageAdapter,
  TombstonedRecord,
  UpdateEdgeStabilityParams,
  UpdateEmbeddingParams,
  UpdateStabilityParams,
} from './storage-adapter.js';

export class InMemoryAdapter implements StorageAdapter {
  private records = new Map<number, LtmRecord & { _deleted?: boolean }>();
  private edges = new Map<number, LtmEdge>();
  private nextRecordId = 1;
  private nextEdgeId = 1;

  insertRecord(record: Omit<LtmRecord, 'id'>): number {
    const id = this.nextRecordId++;
    this.records.set(id, { ...record, id });
    return id;
  }

  bulkInsertRecords(records: Omit<LtmRecord, 'id'>[]): number[] {
    const ids: number[] = [];
    for (const record of records) {
      ids.push(this.insertRecord(record));
    }
    return ids;
  }

  getById(id: number): LtmRecord | TombstonedRecord | undefined {
    const record = this.records.get(id);
    if (!record) {
      return undefined;
    }
    if (record.tombstoned) {
      return {
        id: record.id,
        tombstoned: true,
        tombstonedAt: record.tombstonedAt ?? new Date(),
        data: undefined,
      };
    }
    return record;
  }

  getAllRecords(): LtmRecord[] {
    const results: LtmRecord[] = [];
    for (const record of this.records.values()) {
      if (!record.tombstoned) {
        results.push(record);
      }
    }
    return results;
  }

  updateMetadata(id: number, patch: Record<string, unknown>): boolean {
    const record = this.records.get(id);
    if (!record || record.tombstoned) {
      return false;
    }
    record.metadata = { ...record.metadata, ...patch };
    return true;
  }

  updateEmbedding(id: number, params: UpdateEmbeddingParams): void {
    const record = this.records.get(id);
    if (!record) {
      return;
    }
    record.embedding = params.embedding;
    record.embeddingMeta = params.meta;
  }

  updateStability(id: number, params: UpdateStabilityParams): void {
    const record = this.records.get(id);
    if (!record) {
      return;
    }
    record.stability = params.stability;
    record.lastAccessedAt = params.lastAccessedAt;
    record.accessCount = params.accessCount;
  }

  tombstoneRecord(id: number): void {
    const record = this.records.get(id);
    if (!record) {
      return;
    }
    record.tombstoned = true;
    record.tombstonedAt = new Date();
    record.data = undefined as unknown as string;
    record.embedding = undefined as unknown as Float32Array;
  }

  countTombstoned(): number {
    let count = 0;
    for (const record of this.records.values()) {
      if (record.tombstoned) {
        count++;
      }
    }
    return count;
  }

  deleteRecord(id: number): boolean {
    const record = this.records.get(id);
    if (!record) {
      return false;
    }
    this.records.delete(id);
    this.deleteEdgesFor(id);
    return true;
  }

  insertEdge(edge: Omit<LtmEdge, 'id'>): number {
    const id = this.nextEdgeId++;
    this.edges.set(id, { ...edge, id });
    return id;
  }

  getEdge(id: number): LtmEdge | undefined {
    return this.edges.get(id);
  }

  edgesFrom(fromId: number): LtmEdge[] {
    const results: LtmEdge[] = [];
    for (const edge of this.edges.values()) {
      if (edge.fromId === fromId) {
        results.push(edge);
      }
    }
    return results;
  }

  edgesTo(toId: number): LtmEdge[] {
    const results: LtmEdge[] = [];
    for (const edge of this.edges.values()) {
      if (edge.toId === toId) {
        results.push(edge);
      }
    }
    return results;
  }

  deleteEdgesFor(recordId: number): void {
    for (const [id, edge] of this.edges.entries()) {
      if (edge.fromId === recordId || edge.toId === recordId) {
        this.edges.delete(id);
      }
    }
  }

  updateEdgeStability(id: number, params: UpdateEdgeStabilityParams): void {
    const edge = this.edges.get(id);
    if (!edge) {
      return;
    }
    edge.stability = params.stability;
    edge.lastAccessedAt = params.lastAccessedAt;
  }

  acquireLock(process: string, ttlMs: number): boolean {
    void process;
    void ttlMs;
    return true;
  }

  releaseLock(process: string): void {
    void process;
  }
}
