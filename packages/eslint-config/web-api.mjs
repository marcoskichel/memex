export default [
  {
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'NewExpression[callee.name="Response"]',
          message: 'Use response helpers instead of new Response().',
        },
      ],
    },
  },
  {
    files: ['**/responses/**', '**/__tests__/**', '**/scripts/**'],
    rules: { 'no-restricted-syntax': 'off' },
  },
];
