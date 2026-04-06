import type { MemoryStats } from '@memex/memory';
import { Box, Text } from 'ink';

interface StatusBarProps {
  sessionId: string;
  connected: boolean;
  reconnectCount: number;
  maxReconnectExceeded: boolean;
  stats: MemoryStats | undefined;
  width: number;
}

export function StatusBar({
  sessionId,
  connected,
  reconnectCount,
  maxReconnectExceeded,
  stats,
  width,
}: StatusBarProps) {
  const connectionIndicator = connected ? (
    <Text color="green">● live</Text>
  ) : maxReconnectExceeded ? (
    <Text color="red" wrap="truncate">
      ○ connection lost — restart cortex
    </Text>
  ) : reconnectCount === 0 ? (
    <Text color="yellow">○ connecting...</Text>
  ) : (
    <Text color="yellow">○ reconnecting ({reconnectCount.toString()}/10)</Text>
  );

  const ltmCount = stats ? stats.ltm.totalRecords.toString() : '-';
  const stmPending = stats ? stats.stm.pendingInsights.toString() : '-';

  return (
    <Box borderStyle="single" paddingX={1} width={width} flexDirection="column">
      <Box>
        <Text>session: {sessionId} </Text>
        <Box flexGrow={1}>{connectionIndicator}</Box>
        <Text>
          ltm: {ltmCount} stm: {stmPending}
        </Text>
      </Box>
      <Box>
        <Text color="gray">[:]command [r]reset</Text>
      </Box>
    </Box>
  );
}
