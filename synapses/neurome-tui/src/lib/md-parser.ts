export interface ParsedMemory {
  data: string;
  options?: {
    tier?: 'episodic' | 'semantic';
    category?: string;
    importance?: number;
    tags?: string[];
  };
}

function parseFrontmatter(block: string): ParsedMemory['options'] {
  const options: ParsedMemory['options'] = {};
  let hasAnyKey = false;

  for (const line of block.split('\n')) {
    const match = /^(\w+):\s*(.+)$/.exec(line.trim());
    if (!match) {
      continue;
    }

    const key = match[1];
    const value = match[2];

    if (!key || !value) {
      continue;
    }

    switch (key) {
      case 'tier': {
        if (value === 'episodic' || value === 'semantic') {
          options.tier = value;
          hasAnyKey = true;
        }
        break;
      }
      case 'category': {
        options.category = value.trim();
        hasAnyKey = true;
        break;
      }
      case 'importance': {
        const parsed = Number.parseFloat(value);
        if (!Number.isNaN(parsed)) {
          options.importance = parsed;
          hasAnyKey = true;
        }
        break;
      }
      case 'tags': {
        const inner = value.trim().replaceAll(/^\[|\]$/g, '');
        options.tags = inner
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean);
        hasAnyKey = true;
        break;
      }
      default: {
        break;
      }
    }
  }

  return hasAnyKey ? options : undefined;
}

export function parseMemoryFile(content: string): ParsedMemory[] {
  if (!content.includes('---')) {
    return [];
  }

  const parts = content.split('\n---\n');
  const segments = parts[0]?.trim() === '' ? parts.slice(1) : parts;
  const results: ParsedMemory[] = [];

  for (let index = 0; index < segments.length - 1; index += 2) {
    const frontmatterBlock = segments[index] ?? '';
    const contentBlock = segments[index + 1] ?? '';
    const data = contentBlock.trim();

    if (!data) {
      continue;
    }

    const options = parseFrontmatter(frontmatterBlock);
    results.push(options ? { data, options } : { data });
  }

  return results;
}
