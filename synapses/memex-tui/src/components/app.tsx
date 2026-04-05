import type { PushMessage } from '@memex/cortex';
import type { MemoryStats } from '@memex/memory';
import { Box, useInput, useStdout } from 'ink';
import { useCallback, useEffect, useRef, useState } from 'react';

import { EventsPane } from './events-pane.js';
import { QueryRepl } from './query-repl.js';
import { StatsPane } from './stats-pane.js';
import { StatusBar } from './status-bar.js';
import { MemexSocketClient } from '../client/socket-client.js';

type Pane = 'events' | 'stats' | 'query';

const MAX_EVENTS = 200;
const UPPER_PANE_HEIGHT_RATIO = 0.6;
const STATUS_BAR_HEIGHT = 3;
const LEFT_PANE_WIDTH_RATIO = 0.55;

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
  const clientReference = useRef<MemexSocketClient | null>(null);

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

    client.connect();

    return () => {
      unsubConn();
      unsubPush();
      client.disconnect();
    };
  }, [sessionId]);

  const handleStats = useCallback((memoryStats: MemoryStats) => {
    setStats(memoryStats);
  }, []);

  useInput((input, key) => {
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
      <StatusBar
        sessionId={sessionId}
        connected={connected}
        reconnectCount={reconnectCount}
        maxReconnectExceeded={maxReconnectExceeded}
        stats={stats}
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
        />
      </Box>
      <QueryRepl
        focused={focused === 'query'}
        height={lowerHeight}
        client={clientReference.current ?? undefined}
      />
    </Box>
  );
}
