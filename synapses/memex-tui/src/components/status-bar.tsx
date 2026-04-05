import type { MemoryStats } from '@memex/memory';
import { Box, Text } from 'ink';

interface StatusBarProps {
  sessionId: string;
  connected: boolean;
  reconnectCount: number;
  maxReconnectExceeded: boolean;
  stats: MemoryStats | undefined;
}

export function StatusBar({
  sessionId,
  connected,
  reconnectCount,
  maxReconnectExceeded,
  stats,
}: StatusBarProps) {
  const connectionIndicator = connected ? (
    <Text color="green">● live</Text>
  ) : maxReconnectExceeded ? (
    <Text color="red">○ connection lost — restart cortex</Text>
  ) : (
    <Text color="yellow">
      ○ reconnecting{reconnectCount > 0 ? ` (${reconnectCount.toString()}/10)` : '...'}
    </Text>
  );

  const ltmCount = stats ? stats.ltm.totalRecords.toString() : '-';
  const stmPending = stats ? stats.stm.pendingInsights.toString() : '-';

  return (
    <Box borderStyle="single" paddingX={1}>
      <Text>session: {sessionId} </Text>
      {connectionIndicator}
      <Text>
        {' '}
        ltm: {ltmCount} stm: {stmPending}
      </Text>
    </Box>
  );
}
