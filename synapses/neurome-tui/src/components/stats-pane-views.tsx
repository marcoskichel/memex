import { Box, Text } from 'ink';

export interface RecentRecord {
  id: number;
  data: string;
  tier: 'episodic' | 'semantic';
  category?: string;
  importance: number;
  createdAt: Date | string;
}

const DATA_TRUNCATE_LEN = 36;
const IMPORTANCE_MAX_STARS = 5;
const TIER_COL_WIDTH = 9;
const TIME_COL_WIDTH = 10;
const CATEGORY_COL_WIDTH = 12;
const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;
const MS_PER_WEEK = 604_800_000;

function timeAgo(date: Date | string | undefined): string {
  if (!date) {
    return 'unknown';
  }
  const ms = Date.now() - new Date(date).getTime();
  if (ms < MS_PER_MINUTE) {
    return 'just now';
  }
  if (ms < MS_PER_HOUR) {
    const minutes = Math.floor(ms / MS_PER_MINUTE);
    return `${minutes.toString()}m ago`;
  }
  if (ms < MS_PER_DAY) {
    const hours = Math.floor(ms / MS_PER_HOUR);
    return `${hours.toString()}h ago`;
  }
  if (ms < MS_PER_WEEK) {
    const days = Math.floor(ms / MS_PER_DAY);
    return days === 1 ? '1 day ago' : `${days.toString()} days ago`;
  }
  const weeks = Math.floor(ms / MS_PER_WEEK);
  return weeks === 1 ? '1 week ago' : `${weeks.toString()} weeks ago`;
}

function categoryLabel(category: string | undefined): string {
  return category ? category.replaceAll('_', ' ') : '—';
}

function importanceStars(importance: number): string {
  const filled = Math.round(importance * IMPORTANCE_MAX_STARS);
  return '★'.repeat(filled) + '☆'.repeat(IMPORTANCE_MAX_STARS - filled);
}

export function sortByTime(records: RecentRecord[]): RecentRecord[] {
  return records.toSorted(
    (first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(),
  );
}

interface MemoriesViewProps {
  records: RecentRecord[];
  selectedRecord: number;
  expandedRecord: RecentRecord | undefined;
}

export function MemoriesView({ records, selectedRecord, expandedRecord }: MemoriesViewProps) {
  if (records.length === 0) {
    return <Text color="gray">no recent memories</Text>;
  }

  if (expandedRecord) {
    return (
      <Box flexDirection="column">
        <Box>
          <Text color="gray">{'time:     '}</Text>
          <Text>{timeAgo(expandedRecord.createdAt)}</Text>
        </Box>
        <Box>
          <Text color="gray">{'tier:     '}</Text>
          <Text color={expandedRecord.tier === 'semantic' ? 'blue' : 'yellow'}>
            {expandedRecord.tier}
          </Text>
        </Box>
        <Box>
          <Text color="gray">{'category: '}</Text>
          <Text>{categoryLabel(expandedRecord.category)}</Text>
        </Box>
        <Box>
          <Text color="gray">{'rating:   '}</Text>
          <Text color="yellow">{importanceStars(expandedRecord.importance)}</Text>
        </Box>
        <Box marginTop={1}>
          <Text wrap="wrap">{expandedRecord.data}</Text>
        </Box>
        <Box marginTop={1}>
          <Text color="gray">[Esc] back</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {records.map((record, index) => {
        const isSelected = index === selectedRecord;
        const ago = timeAgo(record.createdAt).padEnd(TIME_COL_WIDTH);
        const tier = record.tier.padEnd(TIER_COL_WIDTH);
        const cat = categoryLabel(record.category)
          .slice(0, CATEGORY_COL_WIDTH)
          .padEnd(CATEGORY_COL_WIDTH);
        const preview = record.data.slice(0, DATA_TRUNCATE_LEN);
        const row = `${ago} ${tier} ${cat}  ${preview}`;
        return (
          <Box key={record.id}>
            {isSelected ? <Text color="cyan">{row}</Text> : <Text color="gray">{row}</Text>}
          </Box>
        );
      })}
      <Box marginTop={1}>
        <Text color="gray">[↑↓] scroll [Enter] expand [s] stats</Text>
      </Box>
    </Box>
  );
}
