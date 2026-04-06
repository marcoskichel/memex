export const noTryCatch = {
  meta: {
    type: 'problem',
    messages: {
      noTryCatch: 'Use Result or ResultAsync from neverthrow instead of try-catch.',
    },
    schema: [],
  },
  create(context) {
    return {
      TryStatement(node) {
        if (node.handler) {
          context.report({ messageId: 'noTryCatch', node: node.handler });
        }
      },
    };
  },
};
