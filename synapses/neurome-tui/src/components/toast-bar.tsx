import { Box, Text } from 'ink';

export interface Toast {
  id: string;
  level: 'error' | 'warn';
  source: string;
  message: string;
}

interface ToastBarProps {
  toasts: Toast[];
}

export function ToastBar({ toasts }: ToastBarProps) {
  const toast = toasts[0];
  if (!toast) {
    return;
  }

  const color = toast.level === 'error' ? 'red' : 'yellow';
  const icon = toast.level === 'error' ? '✗' : '⚠';

  return (
    <Box width="100%">
      <Text color={color}>
        {icon} {toast.source}
        {'  '}
        {toast.message}
      </Text>
    </Box>
  );
}
