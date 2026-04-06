import { Box, Text } from 'ink';

import type { ParsedMemory } from '../lib/md-parser.js';

const MAX_RESULTS_DISPLAYED = 10;
const RESULT_PREVIEW_LENGTH = 60;
const IMPORT_PREVIEW_LIMIT = 10;
const SCORE_PRECISION = 3;

export interface ImportData {
  entries: ParsedMemory[];
  rawText: string;
  isStructured: boolean;
}

export interface RecallResult {
  record: {
    id: number;
    data: string;
    tier: 'episodic' | 'semantic';
    createdAt: string;
    metadata: Record<string, unknown>;
  };
  effectiveScore: number;
}

export function IdleView() {
  return <Text color="gray">type to query memory... (: for commands)</Text>;
}

export function TypingView({ input }: { input: string }) {
  return (
    <Box>
      <Text color="cyan">▶ </Text>
      <Text>{input}</Text>
      <Text color="cyan">█</Text>
    </Box>
  );
}

export function LoadingView({ query }: { query: string }) {
  return (
    <Box flexDirection="column">
      <Box>
        <Text color="cyan">▶ </Text>
        <Text>{query}</Text>
      </Box>
      <Text color="yellow">searching...</Text>
    </Box>
  );
}

function ResultRow({ result, isSelected }: { result: RecallResult; isSelected: boolean }) {
  const tags = (result.record.metadata.tags as string[] | undefined) ?? [];
  const tagString = tags.length > 0 ? `(${tags.join(', ')}) ` : '';
  const preview = result.record.data.slice(0, RESULT_PREVIEW_LENGTH).replaceAll('\n', ' ');
  const scoreString = result.effectiveScore.toFixed(SCORE_PRECISION);
  const content = `${isSelected ? '▶ ' : '  '}${scoreString} [${result.record.tier}] ${tagString}${preview}`;

  return (
    <Box>
      {isSelected ? (
        <Text backgroundColor="cyan" color="black">
          {content}
        </Text>
      ) : (
        <Text>{content}</Text>
      )}
    </Box>
  );
}

export function ResultsView({
  query,
  results,
  selected,
}: {
  query: string;
  results: RecallResult[];
  selected: number;
}) {
  return (
    <Box flexDirection="column">
      <Box>
        <Text color="cyan">▶ </Text>
        <Text>{query}</Text>
        <Text color="gray"> ({results.length.toString()} results)</Text>
      </Box>
      {results.length === 0 ? (
        <Text color="gray">no results</Text>
      ) : (
        results
          .slice(0, MAX_RESULTS_DISPLAYED)
          .map((result, index) => (
            <ResultRow key={result.record.id} result={result} isSelected={index === selected} />
          ))
      )}
      <Text color="gray">↑↓ navigate enter expand esc clear</Text>
    </Box>
  );
}

export function DetailView({ detail }: { detail: RecallResult }) {
  const tags = (detail.record.metadata.tags as string[] | undefined) ?? [];
  return (
    <Box flexDirection="column">
      <Text bold>
        [{detail.record.tier}] score={detail.effectiveScore.toFixed(SCORE_PRECISION)}
        {tags.length > 0 ? ` tags: ${tags.join(', ')}` : ''}
      </Text>
      <Text>{detail.record.data}</Text>
      <Text color="gray">esc back to results</Text>
    </Box>
  );
}

export function ImportPreviewView({ data, importing }: { data: ImportData; importing: boolean }) {
  const totalCount = data.isStructured ? data.entries.length : 1;
  const overflowCount = data.isStructured
    ? Math.max(0, data.entries.length - IMPORT_PREVIEW_LIMIT)
    : 0;
  const visibleEntries = data.isStructured ? data.entries.slice(0, IMPORT_PREVIEW_LIMIT) : [];

  return (
    <Box flexDirection="column">
      <Text bold>Import Preview</Text>
      {data.isStructured ? (
        <>
          <Text color="gray">
            Found {totalCount.toString()} {totalCount === 1 ? 'memory' : 'memories'}
          </Text>
          {visibleEntries.map((entry, index) => (
            <Box key={index}>
              <Text color="gray">{(index + 1).toString().padStart(2)}. </Text>
              <Text>{entry.data.slice(0, RESULT_PREVIEW_LENGTH).replaceAll('\n', ' ')}</Text>
            </Box>
          ))}
          {overflowCount > 0 && <Text color="gray">...and {overflowCount.toString()} more</Text>}
        </>
      ) : (
        <Text color="gray">
          1 text block ({data.rawText.length.toString()} chars) — will be processed by AI
        </Text>
      )}
      {importing ? (
        <Text color="yellow">importing...</Text>
      ) : (
        <Text color="gray">[Enter] import all [Esc] cancel</Text>
      )}
    </Box>
  );
}
