import tseslint from 'typescript-eslint';

import { mustUseResult } from './rules/must-use-result.mjs';
import { noInstance } from './rules/no-instance.mjs';
import { noPromiseReject } from './rules/no-promise-reject.mjs';
import { noThrow } from './rules/no-throw.mjs';
import { noTryCatch } from './rules/no-try-catch.mjs';

const neverthrowPlugin = {
  rules: {
    'must-use-result': mustUseResult,
    'no-instance': noInstance,
    'no-promise-reject': noPromiseReject,
    'no-throw': noThrow,
    'no-try-catch': noTryCatch,
  },
};

export default [
  {
    plugins: { neverthrow: neverthrowPlugin },
    rules: {
      'neverthrow/no-promise-reject': 'error',
      'neverthrow/no-throw': 'error',
      'neverthrow/no-try-catch': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'NewExpression[callee.name="Error"]',
          message: 'Use a domain error class instead of new Error().',
        },
      ],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { projectService: true },
    },
    plugins: { neverthrow: neverthrowPlugin },
    rules: {
      'neverthrow/must-use-result': 'error',
      'neverthrow/no-promise-reject': 'error',
      'neverthrow/no-throw': 'error',
      'neverthrow/no-try-catch': 'error',
    },
  },
  {
    files: ['**/*.test.*', '**/*.spec.*', '**/__tests__/**', '**/scripts/**'],
    rules: {
      'neverthrow/must-use-result': 'off',
      'neverthrow/no-promise-reject': 'off',
      'neverthrow/no-throw': 'off',
      'neverthrow/no-try-catch': 'off',
      'no-restricted-syntax': 'off',
    },
  },
];
