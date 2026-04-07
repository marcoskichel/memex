import baseConfig from '@neurome/eslint-config/base';
import nodeConfig from '@neurome/eslint-config/node';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'eslint.config.mjs', 'vitest.config.ts'] },
  ...baseConfig,
  ...nodeConfig,
  {
    files: [
      'src/start-engram.ts',
      'src/bin/**/*.ts',
      '**/sdk/src/start-engram.ts',
      '**/sdk/src/bin/**/*.ts',
    ],
    rules: {
      'neverthrow/no-throw': 'off',
      'neverthrow/no-try-catch': 'off',
      'neverthrow/no-promise-reject': 'off',
      'no-restricted-syntax': 'off',
      'unicorn/no-process-exit': 'off',
    },
  },
];
