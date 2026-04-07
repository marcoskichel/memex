import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    external: ['better-sqlite3'],
    noExternal: [/^@neurome\//],
  },
  {
    entry: {
      'bin/cortex': 'src/bin/cortex.ts',
      'bin/dendrite': 'src/bin/dendrite.ts',
    },
    format: ['esm'],
    dts: false,
    sourcemap: true,
    external: ['better-sqlite3'],
    noExternal: [/^@neurome\//],
  },
]);
