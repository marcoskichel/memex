export interface InsightEntry {
  id: string;
  summary: string;
  contextFile: string;
  tags: string[];
  timestamp: Date;
  processed: boolean;
}

export class InsightLog {
  private entries: InsightEntry[] = [];

  append(entry: Omit<InsightEntry, 'id' | 'timestamp' | 'processed'>): InsightEntry {
    const newEntry: InsightEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      processed: false,
    };

    this.entries.push(newEntry);
    return newEntry;
  }

  readUnprocessed(): InsightEntry[] {
    return this.entries
      .filter((entry) => !entry.processed)
      .toSorted((first, second) => first.timestamp.getTime() - second.timestamp.getTime());
  }

  markProcessed(ids: string[]): void {
    for (const entry of this.entries) {
      if (ids.includes(entry.id)) {
        entry.processed = true;
      }
    }
  }

  clear(): void {
    this.entries = this.entries.filter((entry) => !entry.processed);
  }
}
