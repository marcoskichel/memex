import { Box, Text, useInput } from 'ink';
import { useEffect, useState } from 'react';

const COMMANDS = [
  { name: 'add', description: 'add new memory' },
  { name: 'consolidate', description: 'consolidate STM → LTM' },
  { name: 'import ', description: 'import memories from file' },
  { name: 'reset', description: 'reset connection' },
] as const;

const MAX_SUGGESTIONS = 5;

interface CommandPaletteProps {
  active: boolean;
  onExecute: (command: string) => void;
  onClose: () => void;
}

export function CommandPalette({ active, onExecute, onClose }: CommandPaletteProps) {
  const [baseInput, setBaseInput] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);

  useEffect(() => {
    if (!active) {
      setBaseInput('');
      setSelectedIndex(-1);
    }
  }, [active]);

  const filtered = COMMANDS.filter((cmd) => cmd.name.startsWith(baseInput)).slice(
    0,
    MAX_SUGGESTIONS,
  );

  const displayInput =
    selectedIndex >= 0 ? (filtered[selectedIndex]?.name ?? baseInput) : baseInput;

  useInput(
    (char, key) => {
      if (key.escape) {
        onClose();
        return;
      }

      if (key.return) {
        onExecute(displayInput);
        setBaseInput('');
        setSelectedIndex(-1);
        return;
      }

      if (key.downArrow) {
        setSelectedIndex((previous) => Math.min(filtered.length - 1, previous + 1));
        return;
      }

      if (key.upArrow) {
        setSelectedIndex((previous) => (previous <= 0 ? -1 : previous - 1));
        return;
      }

      if (key.backspace || key.delete) {
        setSelectedIndex(-1);
        setBaseInput((previous) => previous.slice(0, -1));
        return;
      }

      if (char && !key.ctrl && !key.meta) {
        setSelectedIndex(-1);
        setBaseInput((previous) => previous + char);
      }
    },
    { isActive: active },
  );

  if (!active) {
    return;
  }

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="cyan">{'> '}</Text>
        <Text>{displayInput}</Text>
        <Text color="cyan">█</Text>
      </Box>
      {filtered.map((cmd, index) => (
        <Box key={cmd.name}>
          <Text color={index === selectedIndex ? 'cyan' : 'gray'}>
            {index === selectedIndex ? '► ' : '  '}
            {cmd.name}
          </Text>
          <Text color="gray"> — {cmd.description}</Text>
        </Box>
      ))}
    </Box>
  );
}
