import baseConfig from '@neurome/eslint-config/base';
import nodeConfig from '@neurome/eslint-config/node';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'eslint.config.mjs', 'vitest.config.ts'] },
  ...baseConfig,
  ...nodeConfig,
  {
    files: ['src/bin/**/*.ts'],
    rules: {
      'unicorn/no-process-exit': 'off',
      'neverthrow/no-throw': 'off',
      'neverthrow/no-try-catch': 'off',
    },
  },
  {
    files: ['src/ipc/**/*.ts'],
    rules: {
      'neverthrow/no-throw': 'off',
      'neverthrow/no-try-catch': 'off',
      'neverthrow/must-use-result': 'off',
      'neverthrow/no-promise-reject': 'off',
      'no-restricted-syntax': 'off',
    },
  },
];
