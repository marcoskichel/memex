import type { MemoryStats } from '@neurome/memory';
import { Box, Text, useInput } from 'ink';
import { useCallback, useEffect, useState } from 'react';

import type { RecentRecord } from './stats-pane-views.js';
import { MemoriesView, sortByTime } from './stats-pane-views.js';
import type { MemexSocketClient } from '../client/socket-client.js';

const POLL_INTERVAL_MS = 2000;
const LABEL_WIDTH = 20;
const SCORE_PRECISION = 3;
const RECENT_MEMORIES_LIMIT = 20;

type StatsTab = 'stats' | 'memories';

interface StatsPaneProps {
  focused: boolean;
  width: number;
  height: number;
  client: MemexSocketClient | undefined;
  onStats: (stats: MemoryStats) => void;
  onError: (source: string, message: string) => void;
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Text color="gray">{label.padEnd(LABEL_WIDTH)}</Text>
      <Text>{value}</Text>
    </Box>
  );
}

export function StatsPane({ focused, width, height, client, onStats, onError }: StatsPaneProps) {
  const [stats, setStats] = useState<MemoryStats | undefined>();
  const [tab, setTab] = useState<StatsTab>('stats');
  const [recentRecords, setRecentRecords] = useState<RecentRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState(0);
  const [expandedRecord, setExpandedRecord] = useState<RecentRecord | undefined>();

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
      } catch (error) {
        onError('stats', error instanceof Error ? error.message : 'stats error');
      }
    };

    void poll();
    const interval = setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);
    return () => {
      clearInterval(interval);
    };
  }, [client, onStats, onError]);

  const fetchRecentMemories = useCallback(async () => {
    if (!client) {
      return;
    }
    try {
      const records = await client.getRecent(RECENT_MEMORIES_LIMIT);
      setRecentRecords(sortByTime(records as RecentRecord[]));
      setSelectedRecord(0);
      setExpandedRecord(undefined);
    } catch (error) {
      onError('stats', error instanceof Error ? error.message : 'stats error');
    }
  }, [client, onError]);

  useInput(
    (input, key) => {
      if (input === 's') {
        setTab('stats');
        return;
      }

      if (input === 'm') {
        setTab('memories');
        void fetchRecentMemories();
        return;
      }

      if (tab === 'memories') {
        if (key.upArrow) {
          setSelectedRecord((previous) => Math.max(0, previous - 1));
        } else if (key.downArrow) {
          setSelectedRecord((previous) => Math.min(recentRecords.length - 1, previous + 1));
        } else if (key.return) {
          setExpandedRecord(recentRecords[selectedRecord]);
        } else if (key.escape) {
          setExpandedRecord(undefined);
        }
      }
    },
    { isActive: focused },
  );

  const tabHeader =
    tab === 'stats' ? (
      <Box>
        <Text color="cyan">[s]tats</Text>
        <Text> </Text>
        <Text color="gray">memories</Text>
      </Box>
    ) : (
      <Box>
        <Text color="gray">stats</Text>
        <Text> </Text>
        <Text color="cyan">[m]emories</Text>
      </Box>
    );

  return (
    <Box
      borderStyle="single"
      borderColor={focused ? 'cyan' : undefined}
      width={width}
      height={height}
      flexDirection="column"
      overflow="hidden"
    >
      {tabHeader}
      {tab === 'stats' ? (
        <>
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
        </>
      ) : (
        <MemoriesView
          records={recentRecords}
          selectedRecord={selectedRecord}
          expandedRecord={expandedRecord}
        />
      )}
    </Box>
  );
}
