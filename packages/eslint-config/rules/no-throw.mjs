export const noThrow = {
  meta: {
    type: 'problem',
    messages: {
      noThrow: 'Use Result or ResultAsync from neverthrow instead of throwing errors.',
    },
    schema: [],
  },
  create(context) {
    return {
      ThrowStatement(node) {
        context.report({ messageId: 'noThrow', node });
      },
    };
  },
};
