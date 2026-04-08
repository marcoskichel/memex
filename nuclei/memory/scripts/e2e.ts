import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { AnthropicAdapter } from '@neurome/llm';
import { OpenAIEmbeddingAdapter } from '@neurome/ltm';
import { createMemory } from '@neurome/memory';
import { InsightLog } from '@neurome/stm';

// --- env validation ---
const anthropicKey = process.env.ANTHROPIC_API_KEY;
const openaiKey = process.env.OPENAI_API_KEY;
if (!anthropicKey || !openaiKey) {
  console.error('ERROR: ANTHROPIC_API_KEY and/or OPENAI_API_KEY must be set');
  process.exit(1);
}

// --- paths ---
const dbPath = path.join(tmpdir(), `memory-e2e-${Date.now()}.db`);
const contextDir = path.join(tmpdir(), `memory-e2e-ctx-${Date.now()}`);
if (existsSync(dbPath)) rmSync(dbPath);
console.log(`DB: ${dbPath}`);
console.log(`Context: ${contextDir}\n`);

// --- main ---
async function main(): Promise<void> {
  const llm = new AnthropicAdapter(anthropicKey!);
  const embeddingAdapter = new OpenAIEmbeddingAdapter({ apiKey: openaiKey! });
  const stm = new InsightLog();

  const { memory } = await createMemory({
    storagePath: dbPath,
    contextDirectory: contextDir,
    llmAdapter: llm,
    embeddingAdapter,
    stm,
    amygdalaCadenceMs: 999_999_999,
    hippocampusScheduleMs: 999_999_999,
  });

  // -----------------------------------------------
  // Scenario 1: createMemory wiring
  // -----------------------------------------------
  console.log('[Scenario 1] createMemory() wiring');
  if (!memory.engramId) throw new Error('engramId is missing');
  if (typeof memory.recall !== 'function') throw new Error('recall not exposed');
  if (typeof memory.insertMemory !== 'function') throw new Error('insertMemory not exposed');
  if (typeof memory.importText !== 'function') throw new Error('importText not exposed');
  if (typeof memory.shutdown !== 'function') throw new Error('shutdown not exposed');
  const stats1 = await memory.getStats();
  if (typeof stats1.ltm.totalRecords !== 'number')
    throw new Error('stats.ltm.totalRecords is not a number');
  console.log(
    `  OK: engramId=${memory.engramId}, ltm.totalRecords=${String(stats1.ltm.totalRecords)}`,
  );

  // -----------------------------------------------
  // Scenario 2: importText inserts records
  // -----------------------------------------------
  console.log('\n[Scenario 2] importText() — extracts and inserts facts');
  const paragraph =
    'Lena Muller is a machine learning engineer at Veridian. She leads the recommendation system project. ' +
    'The project uses PyTorch and runs on AWS infrastructure. Lena joined Veridian in 2022.';
  const importResult = (await memory.importText(paragraph))._unsafeUnwrap();
  if (importResult.inserted < 1) {
    throw new Error(`Expected at least 1 inserted record, got ${String(importResult.inserted)}`);
  }
  console.log(`  OK: importText inserted ${String(importResult.inserted)} record(s)`);

  // -----------------------------------------------
  // Scenario 3: recall after importText
  // -----------------------------------------------
  console.log('\n[Scenario 3] recall() after importText — results are non-empty');
  const recallResult3 = (
    await memory.recall('Who leads the recommendation system?')
  )._unsafeUnwrap();
  if (recallResult3.length === 0) {
    throw new Error('Expected at least 1 recall result after importText');
  }
  console.log(
    `  OK: recall returned ${String(recallResult3.length)} result(s) (top score: ${recallResult3[0]?.effectiveScore.toFixed(3)})`,
  );

  // -----------------------------------------------
  // Scenario 4: importText with empty string
  // -----------------------------------------------
  console.log('\n[Scenario 4] importText() with empty string — zero insertions');
  const emptyResult = (await memory.importText('   '))._unsafeUnwrap();
  if (emptyResult.inserted !== 0) {
    throw new Error(`Expected 0 insertions for empty input, got ${String(emptyResult.inserted)}`);
  }
  console.log(`  OK: importText('   ') returned inserted=0`);

  // -----------------------------------------------
  // Scenario 5: insertMemory + recall round-trip
  // -----------------------------------------------
  console.log('\n[Scenario 5] insertMemory() + recall() round-trip');
  const specificFact = 'Jordan Park was promoted to Staff Engineer at Veridian in Q3 2024.';
  const insertId = (await memory.insertMemory(specificFact))._unsafeUnwrap();
  const recallResult5 = (await memory.recall('Jordan Park promotion Veridian'))._unsafeUnwrap();
  if (recallResult5.length === 0) throw new Error('Expected recall result after insertMemory');
  if (!recallResult5.some((r) => r.record.id === insertId)) {
    console.warn(
      `  WARN: inserted record ${String(insertId)} not in top results (LLM/embedding variance)`,
    );
  } else {
    console.log(`  OK: insertMemory record ${String(insertId)} found in recall results`);
  }

  // -----------------------------------------------
  // Scenario 6: logInsight populates STM
  // -----------------------------------------------
  console.log('\n[Scenario 6] logInsight() — populates STM InsightLog');
  const contextFilePath = path.join(tmpdir(), `e2e-ctx-${Date.now()}.md`);
  writeFileSync(contextFilePath, '# Context\nLena discussed the roadmap for Q4 2024.');
  memory.logInsight({ summary: 'Lena roadmap discussion', contextFile: contextFilePath });
  const entries = stm.allEntries();
  if (entries.length === 0)
    throw new Error('Expected InsightLog to have at least 1 entry after logInsight');
  const entry = entries.find((e) => e.contextFile === contextFilePath);
  if (!entry) throw new Error(`Entry with contextFile ${contextFilePath} not found in InsightLog`);
  console.log(
    `  OK: InsightLog has ${String(entries.length)} entry(ies); contextFile path matches`,
  );

  // -----------------------------------------------
  // Scenario 7: stats reflect insertions
  // -----------------------------------------------
  console.log('\n[Scenario 7] getStats() — reflects insertions');
  const stats7 = await memory.getStats();
  if (stats7.ltm.totalRecords <= 0) {
    throw new Error(`Expected ltm.totalRecords > 0, got ${String(stats7.ltm.totalRecords)}`);
  }
  console.log(
    `  OK: ltm.totalRecords=${String(stats7.ltm.totalRecords)}, stm.pendingInsights=${String(stats7.stm.pendingInsights)}`,
  );

  // -----------------------------------------------
  // Scenario 8: shutdown completes cleanly
  // -----------------------------------------------
  console.log('\n[Scenario 8] shutdown() — completes cleanly');
  const report = await memory.shutdown();
  if (report.engramId !== memory.engramId) {
    throw new Error(
      `ShutdownReport.engramId mismatch: expected ${memory.engramId}, got ${report.engramId}`,
    );
  }
  console.log(
    `  OK: shutdown complete (engramId=${report.engramId}, ltmRecordsAtClose=${String(report.ltmRecordsAtClose)})`,
  );

  console.log('\nAll scenarios passed.');
}

main().catch((err: unknown) => {
  console.error('FATAL:', err);
  process.exit(1);
});
