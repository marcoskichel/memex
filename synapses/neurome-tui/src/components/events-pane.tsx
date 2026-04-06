import type { PushMessage } from '@neurome/cortex';
import { Box, Text } from 'ink';

interface EventsPaneProps {
  events: PushMessage[];
  focused: boolean;
  width: number;
  height: number;
}

function payloadString(value: unknown): string {
  if (value === null || value === undefined) {
    return '?';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value as string | number | boolean);
}

function formatEvent(event: PushMessage): string {
  const payload = event.payload as Record<string, unknown>;
  switch (event.name) {
    case 'amygdala:cycle:start': {
      return `▶ amygdala cycle (${payloadString(payload.pendingCount)} pending)`;
    }
    case 'amygdala:cycle:end': {
      return `✓ amygdala ${payloadString(payload.durationMs)}ms — ${payloadString(payload.processed)} processed`;
    }
    case 'amygdala:entry:scored': {
      return `  scored ${payloadString(payload.action)} score=${payloadString(payload.importanceScore)}`;
    }
    case 'hippocampus:consolidation:start': {
      return `▶ hippocampus consolidation`;
    }
    case 'hippocampus:consolidation:end': {
      return `✓ hippocampus ${payloadString(payload.clustersConsolidated)} clusters, ${payloadString(payload.recordsPruned)} pruned`;
    }
    case 'hippocampus:false-memory-risk': {
      return `⚠ false memory risk (confidence=${payloadString(payload.confidence)})`;
    }
    case 'ltm:record:decayed-below-threshold': {
      return `↓ ltm decay id=${payloadString(payload.recordId)} retention=${payloadString(payload.retention)}`;
    }
    case 'ltm:prune:executed': {
      return `✗ ltm prune ${payloadString(payload.removedCount)} records`;
    }
    case 'stm:compression:triggered': {
      return `⟳ stm compression (${payloadString(payload.contextUsagePercent)}% used)`;
    }
    default: {
      return event.name;
    }
  }
}

export function EventsPane({ events, focused, width, height }: EventsPaneProps) {
  const visibleEvents = events.slice(-(height - 2));

  return (
    <Box
      borderStyle="single"
      borderColor={focused ? 'cyan' : undefined}
      width={width}
      height={height}
      flexDirection="column"
      overflow="hidden"
    >
      <Text bold>EVENTS</Text>
      {visibleEvents.map((event, index) => (
        <Text key={index} wrap="truncate">
          {formatEvent(event)}
        </Text>
      ))}
    </Box>
  );
}
