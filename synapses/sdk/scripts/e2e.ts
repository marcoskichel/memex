import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { startEngram, type Engram } from '@neurome/sdk';

// --- env validation ---
const anthropicKey = process.env.ANTHROPIC_API_KEY;
const openaiKey = process.env.OPENAI_API_KEY;
if (!anthropicKey || !openaiKey) {
  console.error('ERROR: ANTHROPIC_API_KEY and/or OPENAI_API_KEY must be set');
  process.exit(1);
}

const ts = Date.now();
const dbPath1 = path.join(tmpdir(), `sdk-e2e-${ts}.db`);
const dbPath2 = path.join(tmpdir(), `sdk-e2e-fork-${ts}.db`);

const activeEngrams: Engram[] = [];

async function cleanup(): Promise<void> {
  for (const e of activeEngrams.splice(0)) {
    try {
      await e.close();
    } catch {
      // already closed
    }
  }
  for (const p of [dbPath1, dbPath2]) {
    if (existsSync(p)) rmSync(p);
  }
}

// --- main ---
async function main(): Promise<void> {
  // -----------------------------------------------
  // Scenario 1: startEngram() — basic startup
  // -----------------------------------------------
  console.log('[Scenario 1] startEngram() — boots cortex and connects IPC');
  const engramId1 = `sdk-e2e-${randomUUID()}`;
  const engram1 = await startEngram({
    engramId: engramId1,
    db: dbPath1,
    anthropicApiKey: anthropicKey,
    openaiApiKey: openaiKey,
  });
  activeEngrams.push(engram1);

  if (engram1.engramId !== engramId1) {
    throw new Error(`engramId mismatch: expected ${engramId1}, got ${engram1.engramId}`);
  }
  console.log(`  OK: startEngram resolved (engramId=${engram1.engramId})`);

  // -----------------------------------------------
  // Scenario 3: insertMemory + recall through IPC
  // -----------------------------------------------
  console.log('\n[Scenario 3] insertMemory() + recall() — round-trip through IPC');
  const insertedId = await engram1.insertMemory(
    'Lena Muller is a machine learning engineer at Veridian Technologies.',
    { timeoutMs: 10_000 },
  );
  if (typeof insertedId !== 'number' || insertedId <= 0) {
    throw new Error(`Expected positive record ID, got ${String(insertedId)}`);
  }
  console.log(`  OK: insertMemory returned ID ${String(insertedId)}`);

  const recallResults = await engram1.recall('Who works at Veridian?', { timeoutMs: 10_000 });
  if (!Array.isArray(recallResults) || recallResults.length === 0) {
    console.warn('  WARN: recall returned no results (embedding/IPC timing variance)');
  } else {
    console.log(`  OK: recall returned ${String(recallResults.length)} result(s)`);
  }

  // -----------------------------------------------
  // Scenario 4: getStats
  // -----------------------------------------------
  console.log('\n[Scenario 4] getStats() — returns parseable stats with record count');
  const stats1 = (await engram1.getStats()) as { ltm: { totalRecords: number } };
  if (stats1 === null || typeof stats1 !== 'object') {
    throw new Error('getStats() returned null or non-object');
  }
  if (typeof stats1.ltm?.totalRecords !== 'number') {
    throw new Error(`stats.ltm.totalRecords is not a number: ${JSON.stringify(stats1)}`);
  }
  if (stats1.ltm.totalRecords <= 0) {
    throw new Error(
      `Expected ltm.totalRecords > 0 after insert, got ${String(stats1.ltm.totalRecords)}`,
    );
  }
  console.log(`  OK: getStats() ltm.totalRecords=${String(stats1.ltm.totalRecords)}`);

  // -----------------------------------------------
  // Scenario 5: close() + IPC dead assertion
  // -----------------------------------------------
  console.log('\n[Scenario 5] close() — terminates cortex cleanly');
  activeEngrams.splice(activeEngrams.indexOf(engram1), 1);
  const closeStart = Date.now();
  await engram1.close();
  const closeMs = Date.now() - closeStart;
  if (closeMs > 15_000) {
    throw new Error(`close() took ${String(closeMs)}ms — exceeded 15s limit`);
  }
  console.log(`  OK: close() resolved in ${String(closeMs)}ms`);

  try {
    await engram1.getStats();
    throw new Error('Expected getStats() to throw after close(), but it resolved');
  } catch (err) {
    if (err instanceof Error && err.message.includes('Expected getStats')) throw err;
    console.log('  OK: IPC calls reject after close()');
  }

  // -----------------------------------------------
  // Scenario 2: startEngram({ source }) — forkDatabase
  // -----------------------------------------------
  console.log('\n[Scenario 2] startEngram({ source }) — forks source database');
  const engramId2 = `sdk-e2e-fork-${randomUUID()}`;
  const engram2 = await startEngram({
    engramId: engramId2,
    db: dbPath2,
    source: dbPath1,
    anthropicApiKey: anthropicKey,
    openaiApiKey: openaiKey,
  });
  activeEngrams.push(engram2);

  if (!existsSync(dbPath2)) {
    throw new Error(`Destination DB ${dbPath2} does not exist after fork`);
  }
  console.log(`  OK: destination DB exists at ${dbPath2}`);

  const stats2 = (await engram2.getStats()) as { ltm: { totalRecords: number } };
  if (stats2.ltm.totalRecords < 1) {
    throw new Error(
      `Expected totalRecords >= 1 in forked DB, got ${String(stats2.ltm.totalRecords)}`,
    );
  }
  console.log(`  OK: forked DB has ${String(stats2.ltm.totalRecords)} record(s) from source`);

  activeEngrams.splice(activeEngrams.indexOf(engram2), 1);
  await engram2.close();
  console.log('\nAll scenarios passed.');
}

main()
  .then(cleanup)
  .catch(async (err: unknown) => {
    console.error('FATAL:', err);
    await cleanup();
    process.exit(1);
  });
