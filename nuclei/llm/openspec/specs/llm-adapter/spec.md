## ADDED Requirements

### Requirement: LLMAdapter interface

The `@neurokit/llm` package SHALL define a `LLMAdapter` interface with two methods: `complete(prompt: string, options?: LLMRequestOptions): Promise<string>` and `completeStructured<T>(prompt: string, schema: StructuredOutputSchema<T>, options?: LLMRequestOptions): Promise<T>`. No provider-specific types SHALL leak through the public API boundary. Embedding is explicitly out of scope for `LLMAdapter`.

#### Scenario: complete returns a string

- **WHEN** `adapter.complete('Hello')` is called
- **THEN** a `Promise<string>` is returned with the model's text response

#### Scenario: completeStructured returns a parsed value

- **WHEN** `adapter.completeStructured(prompt, schema)` is called
- **THEN** a `Promise<T>` is returned where `T` is the type defined by `schema.parse`

#### Scenario: LLMAdapter has no embed method

- **WHEN** the `LLMAdapter` interface is inspected
- **THEN** no `embed` method exists on the interface

### Requirement: LLMRequestOptions

The `LLMAdapter` interface SHALL accept `LLMRequestOptions` with optional fields `maxTokens?: number`, `temperature?: number`, and `systemPrompt?: string`.

#### Scenario: systemPrompt is passed to the underlying model

- **WHEN** `adapter.complete(prompt, { systemPrompt: 'You are X' })` is called
- **THEN** the LLM call includes the system prompt as a system message

### Requirement: StructuredOutputSchema

The `StructuredOutputSchema<T>` type SHALL have fields `name: string`, `description: string`, `shape: Record<string, unknown>`, and `parse: (raw: unknown) => T`. The `parse` function is responsible for validating and transforming the raw LLM output into type `T`.

#### Scenario: parse is called on the raw LLM output

- **WHEN** `completeStructured` receives a response from the LLM
- **THEN** `schema.parse(rawOutput)` is called to produce the final typed result

#### Scenario: parse failure propagates as an error

- **WHEN** `schema.parse` throws on malformed LLM output
- **THEN** `completeStructured` rejects with the parse error

### Requirement: AnthropicAdapter implementation

The package SHALL provide `AnthropicAdapter implements LLMAdapter` with constructor `(apiKey: string, model?: string)` where model defaults to `'claude-haiku-3-5'`. `completeStructured` SHALL use Anthropic's `tool_use` with `tool_choice: { type: 'tool', name: schema.name }` to guarantee structured output. The adapter SHALL NOT re-export any `@anthropic-ai/sdk` types.

#### Scenario: AnthropicAdapter defaults to claude-haiku-3-5

- **WHEN** `new AnthropicAdapter(apiKey)` is called with no model argument
- **THEN** all LLM calls use `claude-haiku-3-5`

#### Scenario: completeStructured uses tool_use

- **WHEN** `adapter.completeStructured(prompt, schema)` is called
- **THEN** the Anthropic API request uses `tools` with the schema definition and `tool_choice: { type: 'tool', name: schema.name }`

#### Scenario: No Anthropic SDK types in public exports

- **WHEN** the `@neurokit/llm` package index is inspected
- **THEN** no types from `@anthropic-ai/sdk` are re-exported

### Requirement: OpenAICompatibleAdapter implementation

The package SHALL provide `OpenAICompatibleAdapter implements LLMAdapter` with constructor `(client: OpenAICompatibleClient, model: string)`. `completeStructured` SHALL use JSON mode: append the schema shape to the prompt and parse the response JSON. The `OpenAICompatibleClient` interface SHALL only require `chat.completions.create()` — no SDK-specific types.

#### Scenario: OpenAICompatibleAdapter accepts any compliant client

- **WHEN** `new OpenAICompatibleAdapter(openaiClient, 'gpt-4o')` is called
- **THEN** LLM calls delegate to `openaiClient.chat.completions.create()`

#### Scenario: completeStructured uses JSON mode

- **WHEN** `adapter.completeStructured(prompt, schema)` is called
- **THEN** the request includes the schema shape appended to the prompt and the response is parsed as JSON

#### Scenario: Ollama client is compatible

- **WHEN** an Ollama client implementing `OpenAICompatibleClient` is injected
- **THEN** `completeStructured` and `complete` work without modification

### Requirement: Both adapters are exported from @neurokit/llm

The package SHALL export `LLMAdapter`, `LLMRequestOptions`, `StructuredOutputSchema`, `AnthropicAdapter`, and `OpenAICompatibleAdapter` from its package index.

#### Scenario: All types and classes importable from @neurokit/llm

- **WHEN** a consumer imports `{ AnthropicAdapter, LLMAdapter } from '@neurokit/llm'`
- **THEN** both are available without importing from sub-paths
