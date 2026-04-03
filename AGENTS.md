<context>
TypeScript monorepo (`@neurokit/root`) building neural memory and AI tooling packages.
Node >= 22, pnpm workspaces, Turborepo, Vitest, ESLint, strict TypeScript.
</context>

<instructions>

- Every npm package should have `dev`, `build`, `lint`, `lint:fix`, `test`, `typecheck`, `check`, and `check:fix`
- Always test your changes before committing with `check:fix`
- Avoid unnecessary inline or dynamic imports

## Architecture: Functional Core, Imperative Shell

Packages are pipelines. Complexity lives in data transformation, not domain models. Keep it simple.

- **Core** — pure functions, zero I/O, always testable without mocks
- **Shell** — thin I/O wrappers (AI SDK, filesystem, external APIs) that feed into core
- All fallible operations return `Result<T, E>` or `ResultAsync<T, E>` from `neverthrow`
- Errors are typed discriminated unions — never raw strings or `unknown`

```
packages/<name>/src/
  core/        # pure functions — parsing, computation, transformation
  shell/       # I/O — AI SDK, file writers, external clients
    clients/   # one file per external system
  index.ts     # entry point: exports public API
```

## Core — Pure Functions

Core functions take plain data in, return `Result` out. No imports from `shell/`.

```typescript
// core/spec-parser.ts
import { Result, err, ok, fromThrowable } from 'neverthrow';

export type SpecParseError =
  | { type: 'MALFORMED_JSON'; raw: string }
  | { type: 'MISSING_STEPS' }
  | { type: 'INVALID_TIMEOUT'; value: unknown };

export type TestSpec = {
  steps: string[];
  timeoutMs: number;
};

const parseJson = fromThrowable(
  JSON.parse,
  (_, raw: string): SpecParseError => ({ type: 'MALFORMED_JSON', raw }),
);

export function parseTestSpec(raw: string): Result<TestSpec, SpecParseError> {
  return parseJson(raw)
    .andThen((data) =>
      Array.isArray(data.steps) && data.steps.length > 0
        ? ok(data)
        : err({ type: 'MISSING_STEPS' } as const),
    )
    .andThen((data) =>
      typeof data.timeoutMs === 'number' && data.timeoutMs > 0
        ? ok({ steps: data.steps as string[], timeoutMs: data.timeoutMs })
        : err({ type: 'INVALID_TIMEOUT', value: data.timeoutMs } as const),
    );
}
```

## Shell — I/O Wrappers

Shell functions wrap external calls in `ResultAsync`. They call into core, never the other way around.

```typescript
// shell/clients/ai-client.ts
import { ResultAsync } from 'neverthrow';
import Anthropic from '@anthropic-ai/sdk';

export type AiError = { type: 'AI_CALL_FAILED'; cause: unknown };

const client = new Anthropic();

export function analyzeText(
  text: string,
  prompt: string,
): ResultAsync<string[], AiError> {
  return ResultAsync.fromPromise(
    client.messages
      .create({ model: 'claude-opus-4-6', max_tokens: 1024, messages: [...] })
      .then(extractFindings),
    (cause): AiError => ({ type: 'AI_CALL_FAILED', cause }),
  );
}
```

## Error Handling Rules

- No `throw` or `try/catch` for control flow — ever
- `fromThrowable` for sync functions that may throw
- `ResultAsync.fromThrowable` for async functions — safer than `fromPromise` when the fn may throw before returning a promise
- `ResultAsync.fromPromise` when you already have a promise in hand
- `mapErr` to translate shell errors into pipeline-level errors at the boundary

```typescript
// fromThrowable — wraps a function, returns a new function
const safeJsonParse = fromThrowable(
  JSON.parse,
  (cause): ParseError => ({ type: 'MALFORMED_JSON', cause }),
);
const result = safeJsonParse(rawString); // Result<unknown, ParseError>

// ResultAsync.fromThrowable — wraps an async function
const safeInsert = ResultAsync.fromThrowable(
  db.insert.bind(db),
  (cause): DbError => ({ type: 'DB_INSERT_FAILED', cause }),
);
const result = safeInsert(record); // ResultAsync<Record, DbError>

// fromPromise — wraps an existing promise
const result = ResultAsync.fromPromise(
  fetch(url).then((r) => r.json()),
  (cause): HttpError => ({ type: 'FETCH_FAILED', cause }),
); // ResultAsync<unknown, HttpError>
```

## Code Quality

- SRP: one function, one reason to change
- DRY: extract shared logic only when used 3+ times and semantically equivalent
- No generic "helpers" files — name by responsibility (`neural-embedder.ts`, not `utils.ts`)
- Guard clauses first; fail fast; shallow nesting
- No comments where code is self-explanatory

## Testing

- Test files live in a `__tests__` directory co-located with the implementation. E.g.: `module.ts` -> `__tests__/module.test.ts`
- Core functions test in complete isolation — no mocks, no I/O
- Shell tests mock at the network/SDK boundary only
- Prefer structural equality — no unsafe unwrap needed

```typescript
import { describe, expect, it } from 'vitest';
import { err, ok } from 'neverthrow';
import { parseTestSpec } from './spec-parser';

describe('parseTestSpec', () => {
  it('parses a valid spec', () => {
    const result = parseTestSpec(JSON.stringify({ steps: ['step one'], timeoutMs: 5000 }));
    expect(result).toEqual(ok({ steps: ['step one'], timeoutMs: 5000 }));
  });

  it('rejects malformed JSON', () => {
    const result = parseTestSpec('{bad');
    expect(result).toEqual(err({ type: 'MALFORMED_JSON', raw: '{bad' }));
  });
});
```

## OpenSpec

- Always use OpenSpec via `pnpm exec openspec`, never from global installation or `npx openspec`

## Naming

- Files/dirs: kebab-case
- Types/interfaces: PascalCase
- Functions/variables: camelCase
- Constants: SCREAMING_SNAKE_CASE
- Booleans: `is*`, `has*`, `should*`
- Core functions: verb + noun (`parseTestSpec`, `buildReport`)
- Shell functions: verb + noun, imperative (`connectToDevice`, `captureScreenshot`)
- Errors: discriminated union with `type` field

## Prompts

- When writing agent prompts, SKILL.md, or instruction files follow `prompt_style.md`

</instructions>
