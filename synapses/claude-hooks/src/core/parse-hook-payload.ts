import { fromThrowable } from 'neverthrow';
import { z } from 'zod';

const PostToolUseSchema = z.object({
  session_id: z.string(),
  tool_name: z.string(),
  tool_input: z.record(z.unknown()),
  tool_response: z.unknown(),
});

const PreToolUseSchema = z.object({
  session_id: z.string(),
  tool_name: z.string(),
  tool_input: z.record(z.unknown()),
});

export type PostToolUsePayload = z.infer<typeof PostToolUseSchema>;
export type PreToolUsePayload = z.infer<typeof PreToolUseSchema>;

const safeJsonParse = fromThrowable((raw: string) => JSON.parse(raw) as unknown);

export function parsePostToolUse(raw: string): PostToolUsePayload | undefined {
  return safeJsonParse(raw).match(
    (parsed) => {
      const result = PostToolUseSchema.safeParse(parsed);
      return result.success ? result.data : undefined;
    },
    () => undefined as PostToolUsePayload | undefined,
  );
}

export function parsePreToolUse(raw: string): PreToolUsePayload | undefined {
  return safeJsonParse(raw).match(
    (parsed) => {
      const result = PreToolUseSchema.safeParse(parsed);
      return result.success ? result.data : undefined;
    },
    () => undefined as PreToolUsePayload | undefined,
  );
}
