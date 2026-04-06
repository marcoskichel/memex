import { describe, expect, it } from 'vitest';

import { parseMemoryFile } from '../lib/md-parser.js';

describe('parseMemoryFile', () => {
  it('returns empty array for empty string', () => {
    expect(parseMemoryFile('')).toEqual([]);
  });

  it('returns empty array when no --- separators present', () => {
    expect(parseMemoryFile('just some plain text')).toEqual([]);
  });

  it('parses a single block with full frontmatter', () => {
    const content = `
---
tier: semantic
category: world_fact
importance: 0.8
tags: [typescript, patterns]
---
TypeScript is a superset of JavaScript.
`.trimStart();

    expect(parseMemoryFile(content)).toEqual([
      {
        data: 'TypeScript is a superset of JavaScript.',
        options: {
          tier: 'semantic',
          category: 'world_fact',
          importance: 0.8,
          tags: ['typescript', 'patterns'],
        },
      },
    ]);
  });

  it('parses multiple blocks', () => {
    const content = `
---
tier: semantic
---
First memory.

---
tier: episodic
---
Second memory.
`.trimStart();

    const result = parseMemoryFile(content);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ data: 'First memory.', options: { tier: 'semantic' } });
    expect(result[1]).toEqual({ data: 'Second memory.', options: { tier: 'episodic' } });
  });

  it('parses a block with no frontmatter keys as having no options', () => {
    const content = `
---

---
Content with empty frontmatter.
`.trimStart();

    expect(parseMemoryFile(content)).toEqual([{ data: 'Content with empty frontmatter.' }]);
  });

  it('missing frontmatter keys default to undefined', () => {
    const content = `
---
tier: episodic
---
Only tier is set.
`.trimStart();

    const result = parseMemoryFile(content);
    expect(result[0]?.options?.tier).toBe('episodic');
    expect(result[0]?.options?.category).toBeUndefined();
    expect(result[0]?.options?.importance).toBeUndefined();
    expect(result[0]?.options?.tags).toBeUndefined();
  });

  it('ignores unknown frontmatter keys', () => {
    const content = `
---
tier: semantic
unknown_key: some_value
another: 123
---
Memory content.
`.trimStart();

    expect(parseMemoryFile(content)).toEqual([
      { data: 'Memory content.', options: { tier: 'semantic' } },
    ]);
  });

  it('skips entries where content is empty after trim', () => {
    const content = `
---
tier: semantic
---

---
tier: episodic
---
Non-empty content.
`.trimStart();

    const result = parseMemoryFile(content);
    expect(result).toHaveLength(1);
    expect(result[0]?.data).toBe('Non-empty content.');
  });

  it('trims whitespace from content', () => {
    const content = `
---
tier: semantic
---
   padded content
`.trimStart();

    expect(parseMemoryFile(content)[0]?.data).toBe('padded content');
  });
});
