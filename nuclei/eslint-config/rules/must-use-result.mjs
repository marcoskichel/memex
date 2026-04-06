import { ESLintUtils } from '@typescript-eslint/utils';
import { unionConstituents } from 'ts-api-utils';

const resultSelector = ':matches(CallExpression, NewExpression)';

const resultProperties = ['andThen', 'map', 'mapErr', 'match', 'orElse', 'unwrapOr'];
const handledMethods = new Set(['_unsafeUnwrap', 'match', 'unwrapOr']);
const endTransverse = new Set(['BlockStatement', 'Program']);
const ignoreParents = new Set([
  'ClassDeclaration',
  'FunctionDeclaration',
  'MethodDefinition',
  'PropertyDefinition',
]);
const tsTypeOnlyParents = new Set([
  'TSInterfaceDeclaration',
  'TSQualifiedName',
  'TSTypeAliasDeclaration',
  'TSTypeAnnotation',
  'TSTypeQuery',
  'TSTypeReference',
]);

function findMemberName(node) {
  if (!node) {
    return;
  }
  if (node.property.type !== 'Identifier') {
    return;
  }
  return node.property.name;
}

function isMemberCalledFunction(node) {
  if (node?.parent?.type !== 'CallExpression') {
    return false;
  }
  return node.parent.callee === node;
}

function isHandledResult(node) {
  let parent = node.parent;
  if (parent?.type === 'AwaitExpression') {
    parent = parent.parent;
  }
  if (parent?.type === 'MemberExpression') {
    const methodName = findMemberName(parent);
    const methodIsCalled = isMemberCalledFunction(parent);
    if (methodName && handledMethods.has(methodName) && methodIsCalled) {
      return true;
    }
    const grandparent = parent.parent;
    if (grandparent && grandparent.type !== 'ExpressionStatement') {
      return isHandledResult(parent);
    }
  }
  return false;
}

function isReturned(node) {
  if (node.type === 'ArrowFunctionExpression') {
    return true;
  }
  if (node.type === 'ExportDefaultDeclaration') {
    return true;
  }
  if (node.type === 'ReturnStatement') {
    return true;
  }
  if (node.type === 'BlockStatement') {
    return false;
  }
  if (node.type === 'Program') {
    return false;
  }
  if (!node.parent) {
    return false;
  }
  return isReturned(node.parent);
}

function createTypeHelpers(checker, services) {
  function isResultLike(node) {
    if (!node) {
      return false;
    }
    const tsNode = services.esTreeNodeToTSNodeMap.get(node);
    const type = checker.getTypeAtLocation(tsNode);
    for (const part of unionConstituents(checker.getApparentType(type))) {
      if (
        resultProperties
          .map((property) => part.getProperty(property))
          .every((property) => property !== undefined)
      ) {
        return true;
      }
    }
    return false;
  }

  function getAssignation(node) {
    if (
      node.type === 'VariableDeclarator' &&
      isResultLike(node.init) &&
      node.id.type === 'Identifier'
    ) {
      return node.id;
    }
    if (endTransverse.has(node.type) || !node.parent) {
      return;
    }
    return getAssignation(node.parent);
  }

  return { isResultLike, getAssignation };
}

export const mustUseResult = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    messages: {
      mustUseResult: 'Result must be handled with either of match, unwrapOr or _unsafeUnwrap.',
    },
    schema: [],
    type: 'problem',
  },
  defaultOptions: [],
  create(context) {
    const services = ESLintUtils.getParserServices(context);
    const checker = services.program.getTypeChecker();
    const { isResultLike, getAssignation } = createTypeHelpers(checker, services);

    function isUnhandledResult(node) {
      if (node.parent && tsTypeOnlyParents.has(node.parent.type)) {
        return false;
      }
      if (node.parent && ignoreParents.has(node.parent.type)) {
        return false;
      }
      if (!isResultLike(node)) {
        return false;
      }
      if (isHandledResult(node)) {
        return false;
      }
      if (isReturned(node)) {
        return false;
      }

      const assignedTo = getAssignation(node);
      if (assignedTo) {
        const variable = context.sourceCode.getScope(node).set.get(assignedTo.name);
        const references =
          variable?.references.filter((reference) => reference.identifier !== assignedTo) ?? [];
        if (references.length > 0) {
          return references.every((reference) => isUnhandledResult(reference.identifier));
        }
      }

      return true;
    }

    return {
      [resultSelector](node) {
        if (isUnhandledResult(node)) {
          context.report({ messageId: 'mustUseResult', node });
        }
      },
    };
  },
});
