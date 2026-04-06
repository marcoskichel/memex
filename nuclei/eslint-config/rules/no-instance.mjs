import { ESLintUtils } from '@typescript-eslint/utils';

export const noInstance = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    messages: {
      noInstance: 'Instantiation of {{name}} is not allowed.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          disallowedClasses: {
            type: 'array',
            items: { type: 'string' },
            uniqueItems: true,
          },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [{ disallowedClasses: [] }],
  create(context) {
    const disallowedClasses = context.options[0]?.disallowedClasses ?? [];
    if (disallowedClasses.length === 0) {
      return {};
    }
    const services = ESLintUtils.getParserServices(context, true);
    if (!services.program) {
      return {};
    }
    const checker = services.program.getTypeChecker();

    function hasDisallowedAncestor(type) {
      const symbolName = type.symbol?.name;
      if (symbolName && disallowedClasses.includes(symbolName)) {
        return true;
      }
      const baseTypes = type.isClassOrInterface() ? checker.getBaseTypes(type) : [];
      return baseTypes.some((base) => hasDisallowedAncestor(base));
    }

    return {
      NewExpression(node) {
        const tsNode = services.esTreeNodeToTSNodeMap.get(node);
        const type = checker.getTypeAtLocation(tsNode);
        if (hasDisallowedAncestor(type)) {
          const name = node.callee.type === 'Identifier' ? node.callee.name : 'unknown';
          context.report({ messageId: 'noInstance', node, data: { name } });
        }
      },
    };
  },
});
