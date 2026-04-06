import { Box, Text, useInput } from 'ink';
import { useCallback, useState } from 'react';

import type { MemexSocketClient } from '../client/socket-client.js';

type FieldName = 'content' | 'tier' | 'category' | 'importance' | 'tags' | 'episodeSummary';

type TierValue = 'episodic' | 'semantic';
type CategoryValue = 'user_preference' | 'world_fact' | 'task_context' | 'agent_belief';

interface FormState {
  content: string;
  tier: TierValue;
  category: CategoryValue;
  importance: number;
  tags: string;
  episodeSummary: string;
  activeField: FieldName;
  saving: boolean;
}

interface MemoryFormProps {
  client: MemexSocketClient | undefined;
  onSave: (id: unknown) => void;
  onCancel: () => void;
  onError: (source: string, message: string) => void;
}

const FIELD_ORDER: FieldName[] = [
  'content',
  'tier',
  'category',
  'importance',
  'tags',
  'episodeSummary',
];

const TIERS: TierValue[] = ['episodic', 'semantic'];

const CATEGORIES: CategoryValue[] = [
  'user_preference',
  'world_fact',
  'task_context',
  'agent_belief',
];

const CATEGORY_ICONS: Record<CategoryValue, string> = {
  user_preference: '👤',
  world_fact: '🌍',
  task_context: '🎯',
  agent_belief: '🤖',
};

const TEXT_FIELDS = new Set<FieldName>(['content', 'tags', 'episodeSummary']);
const IMPORTANCE_MAX = 5;
const IMPORTANCE_MIN = 1;
const DEFAULT_IMPORTANCE = 3;

function renderStars(importance: number): string {
  return '★'.repeat(importance) + '☆'.repeat(IMPORTANCE_MAX - importance);
}

function nextField(current: FieldName): FieldName {
  const index = FIELD_ORDER.indexOf(current);
  return FIELD_ORDER[(index + 1) % FIELD_ORDER.length] ?? current;
}

export function MemoryForm({ client, onSave, onCancel, onError }: MemoryFormProps) {
  const [state, setState] = useState<FormState>({
    content: '',
    tier: 'episodic',
    category: 'user_preference',
    importance: DEFAULT_IMPORTANCE,
    tags: '',
    episodeSummary: '',
    activeField: 'content',
    saving: false,
  });

  const save = useCallback(async () => {
    if (!client) {
      return;
    }

    setState((previous) => ({ ...previous, saving: true }));

    const options = {
      tier: state.tier,
      category: state.category,
      importance: state.importance / IMPORTANCE_MAX,
      tags: state.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      episodeSummary: state.episodeSummary || undefined,
    };

    try {
      const result = await client.insertMemory(state.content, options);
      onSave(result);
    } catch (error) {
      onError('memory-form', error instanceof Error ? error.message : 'save failed');
      setState((previous) => ({ ...previous, saving: false }));
    }
  }, [client, state, onSave, onError]);

  useInput(
    (input, key) => {
      if (state.saving) {
        return;
      }

      if (key.escape) {
        onCancel();
        return;
      }

      if (key.tab) {
        setState((previous) => ({ ...previous, activeField: nextField(previous.activeField) }));
        return;
      }

      const { activeField } = state;

      if (activeField === 'tier' && (key.leftArrow || key.rightArrow)) {
        setState((previous) => {
          const currentIndex = TIERS.indexOf(previous.tier);
          const nextIndex =
            (currentIndex + (key.rightArrow ? 1 : -1) + TIERS.length) % TIERS.length;
          return { ...previous, tier: TIERS[nextIndex] ?? previous.tier };
        });
        return;
      }

      if (activeField === 'category' && (key.leftArrow || key.rightArrow)) {
        setState((previous) => {
          const currentIndex = CATEGORIES.indexOf(previous.category);
          const nextIndex =
            (currentIndex + (key.rightArrow ? 1 : -1) + CATEGORIES.length) % CATEGORIES.length;
          return { ...previous, category: CATEGORIES[nextIndex] ?? previous.category };
        });
        return;
      }

      if (activeField === 'importance' && (key.leftArrow || key.rightArrow)) {
        setState((previous) => {
          const delta = key.rightArrow ? 1 : -1;
          return {
            ...previous,
            importance: Math.min(
              IMPORTANCE_MAX,
              Math.max(IMPORTANCE_MIN, previous.importance + delta),
            ),
          };
        });
        return;
      }

      if (TEXT_FIELDS.has(activeField)) {
        if (key.return && activeField === 'episodeSummary') {
          void save();
          return;
        }

        if (key.backspace || key.delete) {
          setState((previous) => ({
            ...previous,
            [activeField]: (previous[activeField] as string).slice(0, -1),
          }));
          return;
        }

        if (input && !key.ctrl && !key.meta) {
          setState((previous) => ({
            ...previous,
            [activeField]: (previous[activeField] as string) + input,
          }));
        }
      }
    },
    { isActive: true },
  );

  const isActive = (field: FieldName) => state.activeField === field;

  const tierDisplay = TIERS.map((tier) => (tier === state.tier ? `[${tier}]` : tier)).join(' / ');

  function FieldLabel({ field, label }: { field: FieldName; label: string }) {
    return isActive(field) ? <Text color="cyan">{label}</Text> : <Text>{label}</Text>;
  }

  return (
    <Box borderStyle="single" borderColor="cyan" flexDirection="column" paddingX={1}>
      <Text bold>+ New Memory</Text>

      <Box>
        <FieldLabel field="content" label={'📝 content   '} />
        <Text>{state.content}</Text>
        {isActive('content') && <Text color="cyan">█</Text>}
      </Box>

      <Box>
        <FieldLabel field="tier" label={'🧠 tier      '} />
        <Text>{tierDisplay}</Text>
      </Box>

      <Box>
        <FieldLabel field="category" label={'🗂  category  '} />
        <Text>
          {CATEGORY_ICONS[state.category]} {state.category}
        </Text>
      </Box>

      <Box>
        <FieldLabel field="importance" label={'⭐ importance '} />
        <Text>{renderStars(state.importance)}</Text>
      </Box>

      <Box>
        <FieldLabel field="tags" label={'🏷  tags      '} />
        <Text>{state.tags}</Text>
        {isActive('tags') && <Text color="cyan">█</Text>}
      </Box>

      <Box>
        <FieldLabel field="episodeSummary" label={'📄 summary   '} />
        <Text>{state.episodeSummary}</Text>
        {isActive('episodeSummary') && <Text color="cyan">█</Text>}
      </Box>

      {state.saving ? (
        <Text color="yellow">[saving...]</Text>
      ) : (
        <Text color="gray">[Tab] next [Enter] save [Esc] cancel</Text>
      )}
    </Box>
  );
}
