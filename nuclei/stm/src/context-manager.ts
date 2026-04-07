import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { InsightEntry } from './insight-log.js';
import type { InsightLog } from './insight-log.js';

export interface Phase {
  toolCall: string;
  toolResult: string;
  agentReaction: string;
}

export interface CompressResult {
  compressed: string;
  insight: InsightEntry;
}

export type CompressFunction = (phase: Phase) => Promise<string>;

export interface ContextManagerOptions {
  engramId: string;
  contextDir: string;
  maxTokens: number;
  compressionThreshold?: number;
  compressFn: CompressFunction;
  insightLog: InsightLog;
}

interface StoredPhase {
  id: string;
  phase: Phase;
  compressed: boolean;
  tokens: number;
}

const DEFAULT_COMPRESSION_THRESHOLD = 0.7;
const CHARS_PER_TOKEN = 4;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function phaseToRaw(phase: Phase): string {
  return `${phase.toolCall}\n${phase.toolResult}\n${phase.agentReaction}`;
}

export class ContextManager {
  private readonly engramId: string;
  private readonly contextDir: string;
  private readonly maxTokens: number;
  private readonly compressionThreshold: number;
  private readonly compressFn: CompressFunction;
  private readonly insightLog: InsightLog;
  private phases: StoredPhase[] = [];
  private currentTokenCount = 0;

  constructor(options: ContextManagerOptions) {
    this.engramId = options.engramId;
    this.contextDir = options.contextDir;
    this.maxTokens = options.maxTokens;
    this.compressionThreshold = options.compressionThreshold ?? DEFAULT_COMPRESSION_THRESHOLD;
    this.compressFn = options.compressFn;
    this.insightLog = options.insightLog;
  }

  async addPhase(phase: Phase): Promise<{ tokenCount: number; compressed: boolean }> {
    const phaseId = crypto.randomUUID();
    const raw = phaseToRaw(phase);
    const tokens = estimateTokens(raw);

    this.phases.push({ id: phaseId, phase, compressed: false, tokens });
    this.currentTokenCount += tokens;

    const ratio = this.currentTokenCount / this.maxTokens;
    if (ratio >= this.compressionThreshold) {
      const oldest = this.phases.find((phase) => !phase.compressed);
      if (oldest) {
        await this.compressPhase(oldest);
        return { tokenCount: this.currentTokenCount, compressed: true };
      }
    }

    return { tokenCount: this.currentTokenCount, compressed: false };
  }

  async flush(): Promise<void> {
    const uncompressed = this.phases.filter((phase) => !phase.compressed);
    for (const storedPhase of uncompressed) {
      await this.compressPhase(storedPhase);
    }
  }

  get tokenCount(): number {
    return this.currentTokenCount;
  }

  private async compressPhase(storedPhase: StoredPhase): Promise<void> {
    const contextFilePath = path.join(this.contextDir, this.engramId, `${storedPhase.id}.ctx`);

    await mkdir(path.join(this.contextDir, this.engramId), { recursive: true });
    await writeFile(contextFilePath, phaseToRaw(storedPhase.phase), 'utf8');

    const compressed = await this.compressFn(storedPhase.phase);

    this.insightLog.append({
      summary: compressed,
      contextFile: contextFilePath,
      tags: [],
    });

    const compressedTokens = estimateTokens(compressed);
    this.currentTokenCount -= storedPhase.tokens;
    this.currentTokenCount += compressedTokens;

    storedPhase.compressed = true;
    storedPhase.tokens = compressedTokens;
  }
}
