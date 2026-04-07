# `@neurome/llm`

The cognitive processing layer — a uniform adapter interface over Anthropic and OpenAI-compatible APIs, so memory internals stay model-agnostic.

Part of the [Neurome](../../README.md) memory infrastructure.

## Usage

**Basic text completion**

```ts
import { AnthropicAdapter } from '@neurome/llm';

const llm = new AnthropicAdapter(process.env.ANTHROPIC_API_KEY!);

const result = await llm.complete('Summarize this note: "Buy oat milk"');
// => Ok("The note is a grocery reminder to buy oat milk.")

result.match(
  (text) => console.log(text),
  (err) => console.error(err.type),
);
```

**Structured output with a schema**

```ts
import { AnthropicAdapter } from '@neurome/llm';
import type { StructuredOutputSchema } from '@neurome/llm';

interface Tags {
  tags: string[];
}

const tagsSchema: StructuredOutputSchema<Tags> = {
  name: 'extract_tags',
  description: 'Extract topic tags from a memory entry',
  shape: {
    tags: { type: 'array', items: { type: 'string' } },
  },
  parse: (raw) => raw as Tags,
};

const llm = new AnthropicAdapter(process.env.ANTHROPIC_API_KEY!);

const result = await llm.completeStructured({
  prompt: 'Extract tags from: "Picked up coffee and reviewed the Q3 report"',
  schema: tagsSchema,
});
// => Ok({ tags: ['coffee', 'Q3 report', 'work'] })

result.match(
  ({ tags }) => console.log(tags), // ['coffee', 'Q3 report', 'work']
  (err) => console.error(err.type), // 'UNEXPECTED_RESPONSE' | 'NO_CONTENT' | 'PARSE_ERROR'
);
```

## API

| Export                      | Kind      | Description                                                                                                                     |
| --------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `LLMAdapter`                | interface | Core contract: `complete` and `completeStructured`                                                                              |
| `AnthropicAdapter`          | class     | Implements `LLMAdapter` via `@anthropic-ai/sdk`; default model `claude-haiku-4-5-20251001`; uses tool_use for structured output |
| `OpenAICompatibleAdapter`   | class     | Implements `LLMAdapter` against any OpenAI-compatible API; accepts an `OpenAICompatibleClient` and model name                   |
| `LLMError`                  | type      | Union: `{ type: 'UNEXPECTED_RESPONSE' }` \| `{ type: 'NO_CONTENT' }` \| `{ type: 'PARSE_ERROR'; cause: unknown }`               |
| `StructuredOutputSchema<T>` | interface | Schema descriptor: `name`, `description`, `shape` (JSON schema object), `parse: (raw: unknown) => T`                            |
| `LLMRequestOptions`         | interface | Per-request options: `maxTokens?`, `temperature?`, `systemPrompt?`                                                              |
| `StructuredRequest<T>`      | interface | Input to `completeStructured`: `prompt`, `schema`, `options?`                                                                   |
| `OpenAICompatibleClient`    | interface | Minimal client shape accepted by `OpenAICompatibleAdapter`                                                                      |

All methods return `ResultAsync<T, LLMError>` from [neverthrow](https://github.com/supermacro/neverthrow).

Full API reference → <!-- link to docs -->

## Related

- [`@neurome/amygdala`](../amygdala) — emotional relevance scoring; consumes `LLMAdapter` for inference
- [`@neurome/hippocampus`](../hippocampus) — memory consolidation and recall; consumes `LLMAdapter` for embedding and summarisation

## License

MIT
