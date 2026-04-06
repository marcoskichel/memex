# Design — tui-memory-management

## Layout

```
┌────────────────────────────────────────────────────┐
│ ToastBar (1 row, conditional)                      │
│  ✗ stats  fetch timed out                          │  red = error, yellow = warn
├────────────────────────────────────────────────────┤
│ StatusBar — session · ● live · ltm:12 stm:0        │
│             [:]command  [r]reset                   │  hint row (2nd line of status)
├──────────────────────────┬─────────────────────────┤
│ EventsPane               │ StatsPane               │
├──────────────────────────┴─────────────────────────┤
│ QueryRepl / MemoryForm / ImportPreview             │
├────────────────────────────────────────────────────┤
│ CommandPalette (1 row, conditional)                │
│  > _                                               │
└────────────────────────────────────────────────────┘
```

ToastBar and CommandPalette are zero-height when inactive to avoid layout shift.

## Toast Bar

- Queue of `{ id, level: 'error' | 'warn', source: string, message: string, expiresAt: number }`
- Auto-dismiss: `setTimeout` per toast, 4000ms
- Render: one row, first toast in queue, `✗ {source}  {message}` (error=red, warn=yellow)
- Components surface errors via `onError(source, message)` callback prop from `App`
- `StatsPane` and `QueryRepl` currently swallow errors silently — they receive the callback

## Command Palette

- Activated by `:` key from any pane (global `useInput` in App, not pane-local)
- Renders 1 row at the bottom with text input
- `[Esc]` dismisses, `[Enter]` executes
- Autocomplete: static list, cycle with `[Tab]`
- Commands:
  - `:reset` — calls `client.disconnect()` then `client.connect()`; toast on result
  - `:add` — switches QueryRepl to `write` mode
  - `:import <path>` — reads file, switches QueryRepl to `import-preview` mode

## Memory Form (QueryRepl write mode)

New state added to QueryRepl state machine:

```
type ReplState =
  | { mode: 'idle' }
  | { mode: 'typing'; input: string }
  | { mode: 'loading'; query: string }
  | { mode: 'results'; ... }
  | { mode: 'detail'; ... }
  | { mode: 'write'; form: MemoryFormState; activeField: FieldName }    ← new
  | { mode: 'import-preview'; entries: ParsedMemory[]; confirmed: boolean } ← new
```

Fields and controls:

```
Field          Icon  Control             Values
────────────────────────────────────────────────────────────
content         📝   multiline text      free text (required)
tier            🧠   [Tab] to toggle     episodic (cyan) | semantic (blue)
category        🗂   [Tab] to cycle      👤 user_preference | 🌍 world_fact
                                         🎯 task_context | 🤖 agent_belief
importance      ⭐   [←][→] to adjust   ★☆☆☆☆ → ★★★★★ (maps to 0.2…1.0)
tags            🏷   comma-separated     split on ","
episodeSummary  📄   single line         optional
```

Navigation: `[Tab]` moves between fields, `[Enter]` on last field or dedicated save, `[Esc]` cancels back to idle.

## MD Import

### Structured format (file contains `---` separators)

```markdown
---
tier: semantic
category: world_fact
importance: 0.8
tags: [typescript, patterns]
---

TypeScript is a superset of JavaScript that adds static typing.

---

tier: episodic
tags: [debug]

---

The bug was caused by a missing await in the async handler.
```

Parsing in `lib/md-parser.ts`:

- Split on `\n---\n`
- Odd-indexed blocks = frontmatter (parse key: value lines)
- Even-indexed blocks (>0) = content
- Unknown frontmatter keys are ignored
- Missing tier/category/importance default to LTM engine defaults

### Free-text format (no `---` in file)

- Send full text as `importText` IPC payload
- Cortex uses LLM to identify discrete memories and inserts each directly to LTM
- Returns `{ inserted: number }`

### Import preview state

```
┌─────────────────────────────────────────────────────┐
│ Import Preview                                      │
│                                                     │
│ Found 14 memories in ~/notes.md                    │
│                                                     │
│  1. [semantic 🌍] TypeScript is a superset of...   │
│  2. [episodic  ] The bug was caused by a missi...  │
│     ...                                             │
│                                                     │
│ [Enter] import all   [Esc] cancel                   │
└─────────────────────────────────────────────────────┘
```

Shows up to 10 preview rows with truncated content. Remaining count shown if >10.

## IPC Protocol Extensions

```typescript
// protocol.ts additions
interface RequestPayloadMap {
  // existing...
  insertMemory: InsertMemoryPayload;
  importText: ImportTextPayload;
}

interface InsertMemoryPayload {
  data: string;
  options?: LtmInsertOptions;
}

interface ImportTextPayload {
  text: string;
}

// Response types
// insertMemory → { id: number }
// importText   → { inserted: number }
```

## Memory Interface Extensions

```typescript
// memory-types.ts additions
interface Memory {
  // existing...
  insertMemory(data: string, options?: LtmInsertOptions): Promise<number>;
  importText(text: string): Promise<{ inserted: number }>;
}
```

`importText` implementation uses the LLM adapter to produce a structured list of memory strings from arbitrary text, then bulk-inserts via `ltm.insert()`.

## Tabbed StatsPane — Recent Memories

StatsPane gains an internal tab toggle. No layout change.

```
Tab header (always visible at top of pane):
  [s]tats  [m]emories     ← active tab cyan, inactive gray

Stats view (unchanged):
  LTM
   total records  142
   episodic        89
   ...

Memories view:
  Recent Memories
   1  semantic  🌍  TypeScript is a superset of Jav...  ★★★★☆
   2  episodic      The bug was caused by a missing...   ★★☆☆☆
   3  semantic  👤  Prefers dark mode and terse resp...  ★★★☆☆
   ↑↓ scroll  [Enter] detail  [s] back to stats
```

Controls (when StatsPane is focused):

- `[s]` → stats view
- `[m]` → memories view
- `↑↓` → scroll list (memories view only)
- `[Enter]` → expand selected record (full data + metadata overlay within pane)
- `[Esc]` → collapse detail back to list

Memory row format:

```
{n}  {tier}  {categoryIcon}  {data truncated to ~40 chars}  {importanceStars}
```

Category icons: 👤 user_preference · 🌍 world_fact · 🎯 task_context · 🤖 agent_belief  
Importance stars: maps 0.0–1.0 to ☆☆☆☆☆–★★★★★

Polling: fetches on tab activation and after any `insertMemory` call; no continuous polling. Default limit: 20 records.

## IPC — getRecent

```typescript
// protocol.ts addition
interface GetRecentPayload {
  limit: number;
}
// returns: LtmRecord[] sorted by createdAt desc
```

`Memory.getRecent(limit)` queries the LTM storage adapter for the most recently created records, no embedding required — pure SQL `ORDER BY created_at DESC LIMIT ?`.

## Connection Reset

`:reset` command:

1. Calls `client.disconnect()` (sets `stopped = true`, destroys socket)
2. Calls `client.connect()` after reset (needs `stopped` flag cleared first)

The `MemexSocketClient` needs a `reset()` method that clears `stopped`, clears `reconnectAttempts`, then calls `openSocket()`.

## Error Surfacing

Components that currently swallow errors:

| Component           | Current                        | Change                              |
| ------------------- | ------------------------------ | ----------------------------------- |
| `StatsPane`         | `catch {}`                     | calls `onError('stats', e.message)` |
| `QueryRepl`         | returns to idle on recall fail | calls `onError('query', e.message)` |
| `MemexSocketClient` | silently ignores JSON parse    | push to `onError` listener          |

`App` holds `const [toasts, setToasts]` and passes `onError` down. Toast auto-expires via `setTimeout` set at push time.
