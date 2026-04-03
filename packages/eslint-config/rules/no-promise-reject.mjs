export const noPromiseReject = {
  meta: {
    type: 'problem',
    messages: {
      noPromiseReject: 'Use ResultAsync from neverthrow instead of Promise.reject.',
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'Promise' &&
          node.callee.property.type === 'Identifier' &&
          node.callee.property.name === 'reject'
        ) {
          context.report({ messageId: 'noPromiseReject', node });
        }
      },
    };
  },
};
