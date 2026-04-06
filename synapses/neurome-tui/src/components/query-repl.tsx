import { Box, Text, useInput } from 'ink';
import { useCallback, useEffect, useState } from 'react';

import { MemoryForm } from './memory-form.js';
import {
  DetailView,
  IdleView,
  ImportPreviewView,
  LoadingView,
  ResultsView,
  TypingView,
  type ImportData,
  type RecallResult,
} from './query-repl-views.js';
import type { MemexSocketClient } from '../client/socket-client.js';

export type { ImportData } from './query-repl-views.js';

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
    }
  | { mode: 'write' }
  | { mode: 'import-preview'; data: ImportData; importing: boolean };

interface QueryReplProps {
  focused: boolean;
  height: number;
  client: MemexSocketClient | undefined;
  onError: (source: string, message: string) => void;
  externalMode?: 'write' | 'import-preview';
  importData?: ImportData;
  onExternalModeConsumed?: () => void;
  onSaved?: (id: unknown) => void;
  onImported?: (count: number) => void;
  onWriteDone?: () => void;
}

export function QueryRepl({
  focused,
  height,
  client,
  onError,
  externalMode,
  importData,
  onExternalModeConsumed,
  onSaved,
  onImported,
  onWriteDone,
}: QueryReplProps) {
  const [state, setState] = useState<ReplState>({ mode: 'idle' });

  useEffect(() => {
    if (!externalMode) {
      return;
    }
    if (externalMode === 'write') {
      setState({ mode: 'write' });
    } else if (importData) {
      setState({ mode: 'import-preview', data: importData, importing: false });
    }
    onExternalModeConsumed?.();
  }, [externalMode, importData, onExternalModeConsumed]);

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
        .catch((error: unknown) => {
          onError('query', error instanceof Error ? error.message : 'recall failed');
          setState({ mode: 'idle' });
        });
    },
    [client, onError],
  );

  const executeImport = useCallback(
    async (data: ImportData) => {
      if (!client) {
        return;
      }

      setState((previous) =>
        previous.mode === 'import-preview' ? { ...previous, importing: true } : previous,
      );

      try {
        if (data.isStructured) {
          let count = 0;
          for (const entry of data.entries) {
            await client.insertMemory(entry.data, entry.options);
            count++;
          }
          onImported?.(count);
        } else {
          const result = (await client.importText(data.rawText)) as { inserted: number };
          onImported?.(result.inserted);
        }
        setState({ mode: 'idle' });
      } catch (error: unknown) {
        onError('import', error instanceof Error ? error.message : 'import failed');
        setState((previous) =>
          previous.mode === 'import-preview' ? { ...previous, importing: false } : previous,
        );
      }
    },
    [client, onError, onImported],
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
        case 'import-preview': {
          if (key.return && !state.importing) {
            void executeImport(state.data);
          } else if (key.escape && !state.importing) {
            setState({ mode: 'idle' });
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
      {state.mode === 'write' && (
        <MemoryForm
          client={client}
          onSave={(id) => {
            setState({ mode: 'idle' });
            onSaved?.(id);
            onWriteDone?.();
          }}
          onCancel={() => {
            setState({ mode: 'idle' });
            onWriteDone?.();
          }}
          onError={onError}
        />
      )}
      {state.mode === 'import-preview' && (
        <ImportPreviewView data={state.data} importing={state.importing} />
      )}
    </Box>
  );
}
