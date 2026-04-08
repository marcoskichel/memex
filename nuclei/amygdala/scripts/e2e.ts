import { existsSync, rmSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { AnthropicAdapter } from '@neurome/llm';
import { createLtmEngine, OpenAIEmbeddingAdapter, SqliteAdapter } from '@neurome/ltm';
import { InsightLog } from '@neurome/stm';

import { AmygdalaProcess } from '../src/amygdala-process.js';

// --- env validation ---
const anthropicKey = process.env.ANTHROPIC_API_KEY;
const openaiKey = process.env.OPENAI_API_KEY;
if (!anthropicKey || !openaiKey) {
  console.error('ERROR: ANTHROPIC_API_KEY and/or OPENAI_API_KEY must be set');
  process.exit(1);
}

const llm = new AnthropicAdapter(anthropicKey);
const embeddingAdapter = new OpenAIEmbeddingAdapter({ apiKey: openaiKey });

// --- helpers ---
function makeScenarioDb(label: string): { storage: SqliteAdapter; dbPath: string } {
  const dbPath = path.join(tmpdir(), `amygdala-e2e-${label}-${Date.now().toString()}.db`);
  if (existsSync(dbPath)) rmSync(dbPath);
  const storage = new SqliteAdapter(dbPath);
  return { storage, dbPath };
}

async function writeTempContextFile(label: string, content: string): Promise<string> {
  const filePath = path.join(tmpdir(), `amygdala-e2e-ctx-${label}-${Date.now().toString()}.txt`);
  await fs.writeFile(filePath, content);
  return filePath;
}

function countLtmRecords(storage: SqliteAdapter): number {
  return storage.getAllRecords().filter((record) => !record.tombstoned).length;
}

function assertOk(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function makeProcess(
  storage: SqliteAdapter,
  stm: InsightLog,
  overrides: Partial<ConstructorParameters<typeof AmygdalaProcess>[0]> = {},
): AmygdalaProcess {
  const ltm = createLtmEngine(storage, embeddingAdapter);
  return new AmygdalaProcess({
    ltm,
    stm,
    llmAdapter: llm,
    engramId: 'amygdala-e2e',
    ...overrides,
  });
}

// --- main ---
async function main(): Promise<void> {
  // ---------------------------------------------------------------
  // Scenario 1: High-importance insert
  // ---------------------------------------------------------------
  console.log('[Scenario 1] High-importance insert — observation with real context file');
  {
    const { storage, dbPath } = makeScenarioDb('s1');
    console.log(`  DB: ${dbPath}`);

    const contextFile = await writeTempContextFile(
      's1',
      'User has just discovered a critical security vulnerability in the authentication layer. ' +
        'This affects all production users and requires immediate remediation. ' +
        'The issue allows session tokens to be forged without a valid private key.',
    );

    const stm = new InsightLog();
    stm.append({
      summary:
        'Critical security vulnerability discovered: session tokens can be forged without a private key, affecting all production users',
      contextFile,
      tags: ['security', 'critical'],
    });

    const proc = makeProcess(storage, stm);
    await proc.run();

    const count = countLtmRecords(storage);
    assertOk(
      count >= 1,
      `Expected at least 1 LTM record after high-importance insert, got ${count.toString()}`,
    );
    assertOk(stm.readUnprocessed().length === 0, 'Expected all STM entries to be processed');
    console.log(`  OK: ${count.toString()} LTM record(s) inserted`);

    await fs.unlink(contextFile).catch(() => undefined);
  }

  // ---------------------------------------------------------------
  // Scenario 2: Noise skip
  // ---------------------------------------------------------------
  console.log('\n[Scenario 2] Noise skip — trivial observation should not be stored');
  {
    const { storage, dbPath } = makeScenarioDb('s2');
    console.log(`  DB: ${dbPath}`);

    const contextFile = await writeTempContextFile('s2', 'User pressed the spacebar.');

    const stm = new InsightLog();
    stm.append({
      summary: 'User pressed the spacebar',
      contextFile,
      tags: [],
    });

    const proc = makeProcess(storage, stm);
    await proc.run();

    const count = countLtmRecords(storage);
    if (count > 0) {
      console.warn(
        `  WARN: expected 0 LTM records for trivial observation, got ${count.toString()} — LLM chose to insert`,
      );
    } else {
      console.log('  OK: trivial observation skipped, no LTM record written');
    }
    assertOk(stm.readUnprocessed().length === 0, 'Expected all STM entries to be processed');

    await fs.unlink(contextFile).catch(() => undefined);
  }

  // ---------------------------------------------------------------
  // Scenario 3: Follow-up relate
  // ---------------------------------------------------------------
  console.log('\n[Scenario 3] Follow-up relate — second observation related to first');
  {
    const { storage, dbPath } = makeScenarioDb('s3');
    console.log(`  DB: ${dbPath}`);

    const ctx1 = await writeTempContextFile(
      's3-first',
      'Alice prefers TypeScript for all new projects and avoids JavaScript entirely.',
    );
    const ctx2 = await writeTempContextFile(
      's3-second',
      'Alice just confirmed again that she uses TypeScript exclusively for frontend and backend.',
    );

    const stm = new InsightLog();
    stm.append({
      summary: 'Alice strongly prefers TypeScript for all new projects over JavaScript',
      contextFile: ctx1,
      tags: ['preference', 'typescript'],
    });

    const proc = makeProcess(storage, stm);
    await proc.run();

    const afterFirst = countLtmRecords(storage);
    assertOk(
      afterFirst >= 1,
      `Expected at least 1 LTM record after first cycle, got ${afterFirst.toString()}`,
    );

    stm.append({
      summary: 'Alice confirmed again: uses TypeScript exclusively for all new projects',
      contextFile: ctx2,
      tags: ['preference', 'typescript'],
    });

    await proc.run();

    const afterSecond = countLtmRecords(storage);
    assertOk(
      afterSecond >= afterFirst + 1,
      `Expected at least ${(afterFirst + 1).toString()} LTM records after follow-up, got ${afterSecond.toString()}`,
    );
    console.log(
      `  OK: ${afterSecond.toString()} LTM record(s) after follow-up cycle (was ${afterFirst.toString()})`,
    );

    await fs.unlink(ctx1).catch(() => undefined);
    await fs.unlink(ctx2).catch(() => undefined);
  }

  // ---------------------------------------------------------------
  // Scenario 4: Low-cost mode
  // ---------------------------------------------------------------
  console.log('\n[Scenario 4] Low-cost mode — no context file, buildPrompt path');
  {
    const { storage, dbPath } = makeScenarioDb('s4');
    console.log(`  DB: ${dbPath}`);

    const stm = new InsightLog();
    stm.append({
      summary:
        'Alice is migrating all backend services from Node.js to Bun for improved performance',
      contextFile: '',
      tags: ['migration', 'bun'],
    });

    const proc = makeProcess(storage, stm, { lowCostModeThreshold: 0 });
    await proc.run();

    const count = countLtmRecords(storage);
    assertOk(
      count >= 1,
      `Expected at least 1 LTM record after low-cost mode insert, got ${count.toString()}`,
    );
    console.log(`  OK: ${count.toString()} LTM record(s) inserted via low-cost path`);
  }

  // ---------------------------------------------------------------
  // Scenario 5: Lock contention — cycle deferred
  // ---------------------------------------------------------------
  console.log('\n[Scenario 5] Lock contention — cycle deferred when lock is held');
  {
    const { storage, dbPath } = makeScenarioDb('s5');
    console.log(`  DB: ${dbPath}`);

    const contextFile = await writeTempContextFile(
      's5',
      'Alice prefers TypeScript for all new projects.',
    );

    const stm = new InsightLog();
    stm.append({
      summary: 'Alice prefers TypeScript for all new projects',
      contextFile,
      tags: [],
    });

    storage.acquireLock('amygdala', 60_000);

    const proc = makeProcess(storage, stm);
    await proc.run();

    storage.releaseLock('amygdala');

    const count = countLtmRecords(storage);
    assertOk(count === 0, `Expected 0 LTM records while lock held, got ${count.toString()}`);
    console.log('  OK: cycle deferred, no LTM records written while lock held');

    await fs.unlink(contextFile).catch(() => undefined);
  }

  console.log('\nAll scenarios complete.');
}

main().catch((err: unknown) => {
  console.error('FATAL:', err);
  process.exit(1);
});
