import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import type { PushMessage } from '@neurome/cortex-ipc';
import type { MemoryStats } from '@neurome/memory';
import { Box, useInput, useStdout } from 'ink';
import { useCallback, useEffect, useRef, useState } from 'react';

import { CommandPalette } from './command-palette.js';
import { EventsPane } from './events-pane.js';
import type { ImportData } from './query-repl.js';
import { QueryRepl } from './query-repl.js';
import { StatsPane } from './stats-pane.js';
import { StatusBar } from './status-bar.js';
import type { Toast } from './toast-bar.js';
import { ToastBar } from './toast-bar.js';
import { MemexSocketClient } from '../client/socket-client.js';
import { parseMemoryFile } from '../lib/md-parser.js';

type Pane = 'events' | 'stats' | 'query';

const MAX_EVENTS = 200;
const UPPER_PANE_HEIGHT_RATIO = 0.6;
const STATUS_BAR_HEIGHT = 4;
const LEFT_PANE_WIDTH_RATIO = 0.55;
const TOAST_DURATION_MS = 4000;

interface AppProps {
  sessionId: string;
}

export function App({ sessionId }: AppProps) {
  const [focused, setFocused] = useState<Pane>('events');
  const [connected, setConnected] = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);
  const [maxReconnectExceeded, setMaxReconnectExceeded] = useState(false);
  const [events, setEvents] = useState<PushMessage[]>([]);
  const [stats, setStats] = useState<MemoryStats | undefined>();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [paletteActive, setPaletteActive] = useState(false);
  const [externalReplMode, setExternalReplMode] = useState<
    'write' | 'import-preview' | undefined
  >();
  const [importData, setImportData] = useState<ImportData | undefined>();
  const clientReference = useRef<MemexSocketClient | null>(null);

  const pushToast = useCallback(({ level, source, message }: Omit<Toast, 'id'>) => {
    const id = randomUUID();
    setToasts((previous) => [...previous, { id, level, source, message }]);
    setTimeout(() => {
      setToasts((previous) => previous.filter((toast) => toast.id !== id));
    }, TOAST_DURATION_MS);
  }, []);

  const handleError = useCallback(
    (source: string, message: string) => {
      pushToast({ level: 'error', source, message });
    },
    [pushToast],
  );

  useEffect(() => {
    const client = MemexSocketClient.forSession(sessionId);
    clientReference.current = client;

    const unsubConn = client.onConnectionChange((isConnected) => {
      setConnected(isConnected);
      setReconnectCount(client.reconnectCount);
      setMaxReconnectExceeded(client.maxReconnectExceeded);
    });

    const unsubPush = client.onPush((message) => {
      setEvents((previous) => {
        const next = [...previous, message];
        return next.length > MAX_EVENTS ? next.slice(-MAX_EVENTS) : next;
      });
    });

    const unsubError = client.onError(handleError);

    client.connect();

    return () => {
      unsubConn();
      unsubPush();
      unsubError();
      client.disconnect();
    };
  }, [sessionId, handleError]);

  const handleStats = useCallback((memoryStats: MemoryStats) => {
    setStats(memoryStats);
  }, []);

  const handleReset = useCallback(() => {
    const client = clientReference.current;
    if (!client) {
      return;
    }
    try {
      client.reset();
      pushToast({ level: 'warn', source: 'connection', message: 'reconnecting...' });
    } catch (error) {
      pushToast({
        level: 'error',
        source: 'connection',
        message: error instanceof Error ? error.message : 'reset failed',
      });
    }
  }, [pushToast]);

  const executePaletteCommand = useCallback(
    (cmd: string) => {
      setPaletteActive(false);
      const trimmed = cmd.trim().replace(/^:/, '');
      const client = clientReference.current;

      const handlers: Partial<Record<string, () => void>> = {
        reset: handleReset,
        add: () => {
          setFocused('query');
          setExternalReplMode('write');
        },
        consolidate: () => {
          if (client) {
            pushToast({ level: 'warn', source: 'consolidate', message: 'consolidating...' });
            void client.consolidate().then(
              () => {
                pushToast({
                  level: 'warn',
                  source: 'consolidate',
                  message: 'consolidation done',
                });
              },
              (error: unknown) => {
                pushToast({
                  level: 'error',
                  source: 'consolidate',
                  message: error instanceof Error ? error.message : 'consolidation failed',
                });
              },
            );
          }
        },
      };

      const handler = handlers[trimmed];
      if (handler) {
        handler();
        return;
      }

      if (trimmed.startsWith('import ')) {
        const filePath = trimmed.slice('import '.length).trim();
        try {
          const content = readFileSync(filePath, 'utf8');
          const isStructured = content.includes('---');
          const entries = isStructured ? parseMemoryFile(content) : [];
          setImportData({ entries, rawText: content, isStructured });
          setFocused('query');
          setExternalReplMode('import-preview');
        } catch (error) {
          pushToast({
            level: 'error',
            source: 'import',
            message: error instanceof Error ? error.message : `cannot read ${filePath}`,
          });
        }
        return;
      }

      pushToast({ level: 'error', source: 'palette', message: `unknown command: ${trimmed}` });
    },
    [handleReset, pushToast],
  );

  useInput((input, key) => {
    if (paletteActive) {
      return;
    }

    if (input === ':' && focused !== 'query') {
      setPaletteActive(true);
      return;
    }

    if (key.tab) {
      setFocused((previous) => {
        if (previous === 'events') {
          return 'stats';
        }
        if (previous === 'stats') {
          return 'query';
        }
        return 'events';
      });
    }

    if (input === 'r' && focused !== 'query') {
      handleReset();
    }

    if (input === 'q' && focused !== 'query') {
      process.exit(0);
    }
  });

  const { stdout } = useStdout();
  const cols = stdout.columns;
  const rows = stdout.rows;

  const upperHeight = Math.floor(rows * UPPER_PANE_HEIGHT_RATIO);
  const lowerHeight = rows - upperHeight - STATUS_BAR_HEIGHT;
  const leftWidth = Math.floor(cols * LEFT_PANE_WIDTH_RATIO);
  const rightWidth = cols - leftWidth;

  return (
    <Box flexDirection="column" width={cols} height={rows}>
      <ToastBar toasts={toasts} />
      <StatusBar
        sessionId={sessionId}
        connected={connected}
        reconnectCount={reconnectCount}
        maxReconnectExceeded={maxReconnectExceeded}
        stats={stats}
        width={cols}
      />
      <Box flexDirection="row" height={upperHeight}>
        <EventsPane
          events={events}
          focused={focused === 'events'}
          width={leftWidth}
          height={upperHeight}
        />
        <StatsPane
          focused={focused === 'stats'}
          width={rightWidth}
          height={upperHeight}
          client={clientReference.current ?? undefined}
          onStats={handleStats}
          onError={handleError}
        />
      </Box>
      <QueryRepl
        {...{
          focused: focused === 'query',
          height: lowerHeight,
          client: clientReference.current ?? undefined,
          onError: handleError,
          ...(externalReplMode === undefined ? {} : { externalMode: externalReplMode }),
          ...(importData === undefined ? {} : { importData }),
          onExternalModeConsumed: () => {
            setExternalReplMode(undefined);
          },
          onWriteDone: () => {
            setFocused('events');
          },
          onSaved: (id: unknown) => {
            pushToast({ level: 'warn', source: 'memory', message: `saved memory ${String(id)}` });
          },
          onImported: (count: number) => {
            pushToast({
              level: 'warn',
              source: 'import',
              message: `imported ${count.toString()} memories`,
            });
          },
        }}
      />
      <CommandPalette
        active={paletteActive}
        onExecute={executePaletteCommand}
        onClose={() => {
          setPaletteActive(false);
        }}
      />
    </Box>
  );
}
