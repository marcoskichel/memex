import { Box, Text, useInput } from 'ink';
import { useCallback, useState } from 'react';

import type { MemexSocketClient } from '../client/socket-client.js';

const MAX_RESULTS_DISPLAYED = 10;
const RESULT_PREVIEW_LENGTH = 60;
const SCORE_PRECISION = 3;

interface RecallResult {
  record: {
    id: number;
    data: string;
    tier: 'episodic' | 'semantic';
    createdAt: string;
    metadata: Record<string, unknown>;
  };
  effectiveScore: number;
}

type ReplState =
  | { mode: 'idle' }
  | { mode: 'typing'; input: string }
  | { mode: 'loading'; query: string }
  | { mode: 'results'; query: string; results: RecallResult[]; selected: number }
  | {
      mode: 'detail';
      query: string;
      results: RecallResult[];
      selected: number;
      detail: RecallResult;
    };

interface QueryReplProps {
  focused: boolean;
  height: number;
  client: MemexSocketClient | undefined;
}

function IdleView() {
  return <Text color="gray">type to query memory...</Text>;
}

function TypingView({ input }: { input: string }) {
  return (
    <Box>
      <Text color="cyan">▶ </Text>
      <Text>{input}</Text>
      <Text color="cyan">█</Text>
    </Box>
  );
}

function LoadingView({ query }: { query: string }) {
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

function ResultsView({
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

function DetailView({ detail }: { detail: RecallResult }) {
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

export function QueryRepl({ focused, height, client }: QueryReplProps) {
  const [state, setState] = useState<ReplState>({ mode: 'idle' });

  const submitQuery = useCallback(
    (query: string) => {
      if (!query.trim() || !client) {
        return;
      }

      setState({ mode: 'loading', query });

      client
        .recall(query)
        .then((raw) => {
          const results = raw as RecallResult[];
          setState({ mode: 'results', query, results, selected: 0 });
        })
        .catch(() => {
          setState({ mode: 'idle' });
        });
    },
    [client],
  );

  useInput(
    (input, key) => {
      if (!focused) {
        return;
      }

      switch (state.mode) {
        case 'idle': {
          if (input && !key.ctrl && !key.meta) {
            setState({ mode: 'typing', input });
          }
          break;
        }
        case 'typing': {
          if (key.return) {
            submitQuery(state.input);
          } else if (key.escape) {
            setState({ mode: 'idle' });
          } else if (key.backspace || key.delete) {
            const next = state.input.slice(0, -1);
            setState(next ? { mode: 'typing', input: next } : { mode: 'idle' });
          } else if (input && !key.ctrl && !key.meta) {
            setState({ mode: 'typing', input: state.input + input });
          }
          break;
        }
        case 'results': {
          if (key.upArrow) {
            setState({ ...state, selected: Math.max(0, state.selected - 1) });
          } else if (key.downArrow) {
            setState({
              ...state,
              selected: Math.min(state.results.length - 1, state.selected + 1),
            });
          } else if (key.return) {
            const selected = state.results[state.selected];
            if (selected) {
              setState({
                mode: 'detail',
                query: state.query,
                results: state.results,
                selected: state.selected,
                detail: selected,
              });
            }
          } else if (key.escape) {
            setState({ mode: 'idle' });
          }
          break;
        }
        case 'detail': {
          if (key.escape) {
            setState({
              mode: 'results',
              query: state.query,
              results: state.results,
              selected: state.selected,
            });
          }
          break;
        }
        default: {
          break;
        }
      }
    },
    { isActive: focused },
  );

  return (
    <Box
      borderStyle="single"
      borderColor={focused ? 'cyan' : undefined}
      height={height}
      flexDirection="column"
      overflow="hidden"
    >
      <Text bold>QUERY REPL</Text>
      {state.mode === 'idle' && <IdleView />}
      {state.mode === 'typing' && <TypingView input={state.input} />}
      {state.mode === 'loading' && <LoadingView query={state.query} />}
      {state.mode === 'results' && (
        <ResultsView query={state.query} results={state.results} selected={state.selected} />
      )}
      {state.mode === 'detail' && <DetailView detail={state.detail} />}
    </Box>
  );
}
