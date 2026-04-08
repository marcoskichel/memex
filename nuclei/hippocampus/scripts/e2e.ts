import { existsSync, rmSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { AnthropicAdapter } from '@neurome/llm';
import { createLtmEngine, OpenAIEmbeddingAdapter, SqliteAdapter } from '@neurome/ltm';
import type { LtmRecord } from '@neurome/ltm';
import { InsightLog } from '@neurome/stm';

import type { HippocampusConsolidationEndPayload } from '../src/hippocampus-process.js';
import { HippocampusProcess } from '../src/hippocampus-process.js';

// --- env validation ---
const anthropicKey = process.env.ANTHROPIC_API_KEY;
const openaiKey = process.env.OPENAI_API_KEY;
if (!anthropicKey || !openaiKey) {
  console.error('ERROR: ANTHROPIC_API_KEY and/or OPENAI_API_KEY must be set');
  process.exit(1);
}

const llm = new AnthropicAdapter(anthropicKey);
const embeddingAdapter = new OpenAIEmbeddingAdapter({ apiKey: openaiKey });

// --- per-scenario DB factory ---
function makeScenarioDb(label: string): {
  storage: SqliteAdapter;
  ltm: ReturnType<typeof createLtmEngine>;
  dbPath: string;
} {
  const dbPath = path.join(tmpdir(), `hippocampus-e2e-${label}-${Date.now().toString()}.db`);
  if (existsSync(dbPath)) rmSync(dbPath);
  const storage = new SqliteAdapter(dbPath);
  const ltm = createLtmEngine(storage, embeddingAdapter);
  return { storage, ltm, dbPath };
}

// --- helpers ---
async function insertRecord(
  storage: SqliteAdapter,
  text: string,
  overrides: Partial<Omit<LtmRecord, 'id' | 'data' | 'embedding' | 'embeddingMeta'>> = {},
): Promise<number> {
  const embedResult = await embeddingAdapter.embed(text);
  if (embedResult.isErr()) throw new Error(`Embed failed for "${text}": ${embedResult.error.type}`);
  const { vector, modelId, dimensions } = embedResult.value;
  return storage.insertRecord({
    data: text,
    metadata: {},
    embedding: vector,
    embeddingMeta: { modelId, dimensions },
    tier: 'episodic',
    importance: 0.5,
    stability: 1,
    lastAccessedAt: new Date(),
    accessCount: 2,
    createdAt: new Date(),
    tombstoned: false,
    tombstonedAt: undefined,
    engramId: 'hippocampus-e2e',
    ...overrides,
  });
}

function countLtmRecords(storage: SqliteAdapter): number {
  return storage.getAllRecords().filter((r) => !r.tombstoned).length;
}

function assertOk(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function makeEventBus(): {
  emit(event: string, payload?: unknown): boolean;
  on(event: string, listener: (...args: unknown[]) => void): void;
} {
  const listeners = new Map<string, ((...args: unknown[]) => void)[]>();
  return {
    emit(event, payload) {
      const handlers = listeners.get(event) ?? [];
      for (const h of handlers) h(payload);
      return handlers.length > 0;
    },
    on(event, listener) {
      listeners.set(event, [...(listeners.get(event) ?? []), listener]);
    },
  };
}

function makeProcess(
  ltm: ReturnType<typeof createLtmEngine>,
  overrides: Partial<ConstructorParameters<typeof HippocampusProcess>[0]> = {},
): HippocampusProcess {
  return new HippocampusProcess({ ltm, llmAdapter: llm, similarityThreshold: 0.7, ...overrides });
}

// --- main ---
async function main(): Promise<void> {
  // ---------------------------------------------------------------
  // Scenario 1: Baseline consolidation — 3 similar records → 1 semantic
  // ---------------------------------------------------------------
  console.log('[Scenario 1] Baseline consolidation — 3 similar records');
  {
    const { storage, ltm, dbPath } = makeScenarioDb('s1');
    console.log(`  DB: ${dbPath}`);

    await insertRecord(storage, 'Alice strongly prefers TypeScript for all new projects');
    await insertRecord(storage, 'Alice consistently chooses TypeScript over JavaScript');
    await insertRecord(storage, 'Alice avoids JavaScript and always reaches for TypeScript');

    const before = countLtmRecords(storage);
    assertOk(before === 3, `Expected 3 records before run, got ${before.toString()}`);

    const events = makeEventBus();
    let endPayload: HippocampusConsolidationEndPayload | undefined;
    events.on('hippocampus:consolidation:end', (p) => {
      endPayload = p as HippocampusConsolidationEndPayload;
    });
    const proc = makeProcess(ltm, { events });
    await proc.run();

    const end = endPayload;
    if (!end) throw new Error('consolidation:end event not emitted');

    const semanticCount = storage
      .getAllRecords()
      .filter((r) => !r.tombstoned && r.tier === 'semantic').length;
    assertOk(
      semanticCount >= 1,
      `Expected at least 1 semantic record, got ${semanticCount.toString()}`,
    );
    assertOk(
      end.clustersConsolidated >= 1,
      `Expected clustersConsolidated >= 1, got ${end.clustersConsolidated.toString()}`,
    );
    console.log(
      `  OK: clustersConsolidated=${end.clustersConsolidated.toString()}, semanticRecords=${semanticCount.toString()}`,
    );
    console.log(
      `  recordsPruned=${end.recordsPruned.toString()} (fresh records — prune does not remove)`,
    );
  }

  // ---------------------------------------------------------------
  // Scenario 2: Temporal split — 3 Jan records + 3 Jul records → 2 consolidations
  // ---------------------------------------------------------------
  console.log('\n[Scenario 2] Temporal split — 3 Jan + 3 Jul records');
  {
    const { storage, ltm, dbPath } = makeScenarioDb('s2');
    console.log(`  DB: ${dbPath}`);

    const jan = new Date('2024-01-05');
    const jul = new Date('2024-07-05');

    await insertRecord(storage, 'Alice strongly prefers TypeScript for all new projects', {
      createdAt: jan,
      lastAccessedAt: jan,
    });
    await insertRecord(storage, 'Alice consistently chooses TypeScript over JavaScript', {
      createdAt: new Date('2024-01-10'),
      lastAccessedAt: jan,
    });
    await insertRecord(storage, 'Alice avoids JavaScript and always reaches for TypeScript', {
      createdAt: new Date('2024-01-15'),
      lastAccessedAt: jan,
    });

    await insertRecord(storage, 'Alice continues to rely exclusively on TypeScript', {
      createdAt: jul,
      lastAccessedAt: jul,
    });
    await insertRecord(storage, 'Alice mentioned preferring TypeScript for its type safety', {
      createdAt: new Date('2024-07-10'),
      lastAccessedAt: jul,
    });
    await insertRecord(storage, "Alice's tooling preference remains TypeScript for type checking", {
      createdAt: new Date('2024-07-15'),
      lastAccessedAt: jul,
    });

    const before = countLtmRecords(storage);
    assertOk(before === 6, `Expected 6 records before run, got ${before.toString()}`);

    const events = makeEventBus();
    let endPayload: HippocampusConsolidationEndPayload | undefined;
    events.on('hippocampus:consolidation:end', (p) => {
      endPayload = p as HippocampusConsolidationEndPayload;
    });
    const proc = makeProcess(ltm, { events });
    await proc.run();

    const end = endPayload;
    if (!end) throw new Error('consolidation:end event not emitted');

    if (end.clustersConsolidated !== 2) {
      console.warn(
        `  WARN: expected 2 consolidations (temporal split), got ${end.clustersConsolidated.toString()} — embeddings may not have formed a single cluster`,
      );
    } else {
      console.log(
        `  OK: clustersConsolidated=${end.clustersConsolidated.toString()} (temporal split produced 2 sub-clusters)`,
      );
    }

    const semanticCount = storage
      .getAllRecords()
      .filter((r) => !r.tombstoned && r.tier === 'semantic').length;
    console.log(`  semanticRecords=${semanticCount.toString()}`);
  }

  // ---------------------------------------------------------------
  // Scenario 3: Below minClusterSize — 2 similar records, no consolidation
  // ---------------------------------------------------------------
  console.log('\n[Scenario 3] Below minClusterSize — 2 similar records');
  {
    const { storage, ltm, dbPath } = makeScenarioDb('s3');
    console.log(`  DB: ${dbPath}`);

    await insertRecord(storage, 'Alice strongly prefers TypeScript for all new projects');
    await insertRecord(storage, 'Alice consistently chooses TypeScript over JavaScript');

    const events = makeEventBus();
    let endPayload: HippocampusConsolidationEndPayload | undefined;
    events.on('hippocampus:consolidation:end', (p) => {
      endPayload = p as HippocampusConsolidationEndPayload;
    });
    const proc = makeProcess(ltm, { minClusterSize: 3, events });
    await proc.run();

    const end = endPayload;
    if (!end) throw new Error('consolidation:end event not emitted');

    assertOk(
      end.clustersConsolidated === 0,
      `Expected 0 consolidations (cluster too small), got ${end.clustersConsolidated.toString()}`,
    );

    const after = countLtmRecords(storage);
    assertOk(after === 2, `Expected record count unchanged at 2, got ${after.toString()}`);
    console.log(`  OK: no consolidation, record count unchanged at ${after.toString()}`);
  }

  // ---------------------------------------------------------------
  // Scenario 4: Prune — old records deflated below retention threshold
  // ---------------------------------------------------------------
  console.log('\n[Scenario 4] Prune — old records pruned after consolidation');
  {
    const { storage, ltm, dbPath } = makeScenarioDb('s4');
    console.log(`  DB: ${dbPath}`);

    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

    await insertRecord(storage, 'Alice strongly prefers TypeScript for all new projects', {
      lastAccessedAt: oneYearAgo,
    });
    await insertRecord(storage, 'Alice consistently chooses TypeScript over JavaScript', {
      lastAccessedAt: oneYearAgo,
    });
    await insertRecord(storage, 'Alice avoids JavaScript and always reaches for TypeScript', {
      lastAccessedAt: oneYearAgo,
    });

    const before = countLtmRecords(storage);

    const events = makeEventBus();
    let endPayload: HippocampusConsolidationEndPayload | undefined;
    events.on('hippocampus:consolidation:end', (p) => {
      endPayload = p as HippocampusConsolidationEndPayload;
    });
    const proc = makeProcess(ltm, { events });
    await proc.run();

    const end = endPayload;
    if (!end) throw new Error('consolidation:end event not emitted');

    if (end.clustersConsolidated < 1) {
      console.warn('  WARN: no consolidation occurred — cannot verify prune behavior');
    } else {
      assertOk(
        end.recordsPruned > 0,
        `Expected pruned > 0 after consolidating old records, got ${end.recordsPruned.toString()}`,
      );
      const after = countLtmRecords(storage);
      assertOk(
        after < before,
        `Expected record count to decrease after prune, was ${before.toString()}, now ${after.toString()}`,
      );
      console.log(
        `  OK: recordsPruned=${end.recordsPruned.toString()}, records ${before.toString()} → ${after.toString()}`,
      );
    }
  }

  // ---------------------------------------------------------------
  // Scenario 5: STM context file cleanup
  // ---------------------------------------------------------------
  console.log('\n[Scenario 5] STM context file cleanup');
  {
    const { storage, ltm, dbPath } = makeScenarioDb('s5');
    console.log(`  DB: ${dbPath}`);

    const stm = new InsightLog();

    const file1 = path.join(tmpdir(), `hippocampus-e2e-ctx-${Date.now().toString()}-1.txt`);
    const file2 = path.join(tmpdir(), `hippocampus-e2e-ctx-${Date.now().toString()}-2.txt`);
    await fs.writeFile(file1, 'Alice prefers TypeScript — context file 1');
    await fs.writeFile(file2, 'Alice prefers TypeScript — context file 2');

    stm.append({
      summary: 'Alice prefers TypeScript',
      contextFile: file1,
      tags: [],
      safeToDelete: true,
    });
    stm.append({
      summary: 'Alice prefers TypeScript again',
      contextFile: file2,
      tags: [],
      safeToDelete: true,
    });

    const proc = makeProcess(ltm, { stm });
    await proc.run();

    const file1Exists = existsSync(file1);
    const file2Exists = existsSync(file2);
    assertOk(!file1Exists, `Expected context file 1 to be deleted, but it still exists: ${file1}`);
    assertOk(!file2Exists, `Expected context file 2 to be deleted, but it still exists: ${file2}`);
    console.log('  OK: both context files deleted');
  }

  // ---------------------------------------------------------------
  // Scenario 6: Lock contention — cycle deferred
  // ---------------------------------------------------------------
  console.log('\n[Scenario 6] Lock contention — cycle deferred');
  {
    const { storage, ltm, dbPath } = makeScenarioDb('s6');
    console.log(`  DB: ${dbPath}`);

    await insertRecord(storage, 'Alice strongly prefers TypeScript for all new projects');
    await insertRecord(storage, 'Alice consistently chooses TypeScript over JavaScript');
    await insertRecord(storage, 'Alice avoids JavaScript and always reaches for TypeScript');

    storage.acquireLock('hippocampus', 60_000);

    const before = countLtmRecords(storage);
    const proc = makeProcess(ltm);
    await proc.run();

    storage.releaseLock('hippocampus');

    const after = countLtmRecords(storage);
    assertOk(
      after === before,
      `Expected no consolidation while locked, record count unchanged at ${before.toString()}, got ${after.toString()}`,
    );
    console.log(`  OK: cycle deferred, record count unchanged at ${after.toString()}`);
  }

  console.log('\nAll scenarios complete.');
}

main().catch((err: unknown) => {
  console.error('FATAL:', err);
  process.exit(1);
});
