import type { MemoryStats } from '@memex/memory';
import { Box, Text } from 'ink';
import { useEffect, useState } from 'react';

import type { MemexSocketClient } from '../client/socket-client.js';

const POLL_INTERVAL_MS = 2000;
const LABEL_WIDTH = 20;
const SCORE_PRECISION = 3;

interface StatsPaneProps {
  focused: boolean;
  width: number;
  height: number;
  client: MemexSocketClient | undefined;
  onStats: (stats: MemoryStats) => void;
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Text color="gray">{label.padEnd(LABEL_WIDTH)}</Text>
      <Text>{value}</Text>
    </Box>
  );
}

export function StatsPane({ focused, width, height, client, onStats }: StatsPaneProps) {
  const [stats, setStats] = useState<MemoryStats | undefined>();

  useEffect(() => {
    if (!client) {
      return;
    }

    const poll = async () => {
      try {
        const result = await client.getStats();
        const memoryStats = result as MemoryStats;
        setStats(memoryStats);
        onStats(memoryStats);
      } catch {}
    };

    void poll();
    const interval = setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);
    return () => {
      clearInterval(interval);
    };
  }, [client, onStats]);

  return (
    <Box
      borderStyle="single"
      borderColor={focused ? 'cyan' : undefined}
      width={width}
      height={height}
      flexDirection="column"
      overflow="hidden"
    >
      <Text bold>STATS</Text>
      {stats ? (
        <>
          <Text bold color="blue">
            LTM
          </Text>
          <StatRow label="total records" value={stats.ltm.totalRecords.toString()} />
          <StatRow label="episodic" value={stats.ltm.episodicCount.toString()} />
          <StatRow label="semantic" value={stats.ltm.semanticCount.toString()} />
          <StatRow
            label="avg retention"
            value={stats.ltm.averageRetention.toFixed(SCORE_PRECISION)}
          />
          <Text bold color="blue">
            STM
          </Text>
          <StatRow label="pending insights" value={stats.stm.pendingInsights.toString()} />
          <Text bold color="blue">
            Hippocampus
          </Text>
          <StatRow
            label="clusters (last)"
            value={stats.hippocampus.lastRunClustersConsolidated.toString()}
          />
          <StatRow
            label="pruned (last)"
            value={stats.hippocampus.lastRunRecordsPruned.toString()}
          />
          <Text bold color="blue">
            Disk
          </Text>
          <StatRow label="context files" value={stats.disk.contextFilesOnDisk.toString()} />
        </>
      ) : (
        <Text color="gray">waiting for data...</Text>
      )}
    </Box>
  );
}
