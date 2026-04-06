import baseConfig from './nuclei/eslint-config/base.mjs';
import nodeConfig from './nuclei/eslint-config/node.mjs';
import neverthrowConfig from './nuclei/eslint-config/neverthrow.mjs';

export default [
  { ignores: ['**/dist/**', '**/node_modules/**', '**/vitest.config.ts', '**/eslint.config.mjs', 'scripts/**'] },
  ...baseConfig,
  ...nodeConfig,
  ...neverthrowConfig,
  {
    files: ['**/src/bin/**/*.ts', '**/synapses/**/src/bin/**/*.ts'],
    rules: {
      'unicorn/no-process-exit': 'off',
      'unicorn/prefer-top-level-await': 'off',
      'neverthrow/no-throw': 'off',
      'neverthrow/no-try-catch': 'off',
    },
  },
  {
    files: ['**/synapses/cortex/src/ipc/**/*.ts', '**/nuclei/cortex-ipc/src/**/*.ts'],
    rules: {
      'neverthrow/no-throw': 'off',
      'neverthrow/no-try-catch': 'off',
      'neverthrow/must-use-result': 'off',
      'no-restricted-syntax': 'off',
    },
  },
  {
    files: ['**/synapses/neurome-tui/src/**/*.{ts,tsx}'],
    rules: {
      'neverthrow/no-throw': 'off',
      'neverthrow/no-try-catch': 'off',
      'neverthrow/no-promise-reject': 'off',
      'max-lines-per-function': 'off',
      'unicorn/no-process-exit': 'off',
      'no-restricted-syntax': 'off',
    },
  },
  {
    files: ['**/synapses/claude-hooks/src/shell/**/*.ts'],
    rules: {
      'neverthrow/no-throw': 'off',
      'neverthrow/no-try-catch': 'off',
      'no-restricted-syntax': 'off',
    },
  },
];
