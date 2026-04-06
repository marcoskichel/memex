import functional from 'eslint-plugin-functional';

export default [
  {
    files: ['**/core/**/*.ts', '**/core/**/*.mts', '**/core/**/*.cts'],
    ignores: ['**/__tests__/**', '**/*.test.*', '**/*.spec.*'],
    plugins: { functional },
    rules: {
      'functional/no-expression-statements': 'error',
      'functional/immutable-data': 'error',
      'no-restricted-globals': [
        'error',
        { name: 'console', message: 'No I/O in core/ — use shell/ for side effects.' },
        { name: 'process', message: 'No process access in core/ — use shell/ for I/O.' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/shell/**', '../shell/**', '../../shell/**'],
              message: 'core/ must not import from shell/ — keep the pure core isolated.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'AwaitExpression',
          message: 'core/ must be synchronous — no await.',
        },
        {
          selector: 'FunctionDeclaration[async=true]',
          message: 'core/ must be synchronous — no async functions.',
        },
        {
          selector: 'ArrowFunctionExpression[async=true]',
          message: 'core/ must be synchronous — no async arrow functions.',
        },
        {
          selector: "NewExpression[callee.name='Promise']",
          message: 'core/ must be synchronous — no Promise constructor.',
        },
        {
          selector: "MemberExpression[object.name='Date'][property.name='now']",
          message: 'core/ must be deterministic — inject time via parameters.',
        },
        {
          selector: "MemberExpression[object.name='Math'][property.name='random']",
          message: 'core/ must be deterministic — inject randomness via parameters.',
        },
      ],
    },
  },
];
