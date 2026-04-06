## 1. Socket Client

- [x] 1.1 Add `insertMemory(data: string, options?: LtmInsertOptions): Promise<{ id: number }>` to `src/client/socket-client.ts`
- [x] 1.2 Add `importText(text: string): Promise<{ inserted: number }>` to `src/client/socket-client.ts`
- [x] 1.3 Add `getRecent(limit: number): Promise<LtmRecord[]>` to `src/client/socket-client.ts`
- [x] 1.4 Add `reset()` to `src/client/socket-client.ts` — clears `stopped` flag and `reconnectAttempts`, calls `openSocket()`
- [x] 1.5 Add unit tests in `src/__tests__/socket-client.test.ts`: each method sends correct IPC message; `reset()` clears stopped flag and re-opens socket

## 2. Toast Bar

- [x] 2.1 Create `src/components/toast-bar.tsx` — renders first toast in queue; red for error, yellow for warn; format `✗ {source}  {message}`; zero height when queue empty
- [x] 2.2 Add `toasts` state and `pushToast(level, source, message)` helper to `src/components/app.tsx`; schedule 4s auto-removal per toast; render `<ToastBar>` above `<StatusBar>`
- [x] 2.3 Add `onError` prop to `src/components/stats-pane.tsx`; replace `catch {}` with `onError('stats', e.message)`
- [x] 2.4 Add `onError` prop to `src/components/query-repl.tsx`; replace silent idle fallback with `onError('query', e.message)` then return to idle
- [x] 2.5 Add `onError` listener type to `src/client/socket-client.ts`; push JSON parse errors to registered listeners
- [x] 2.6 Wire all `onError` callbacks to `pushToast` in `src/components/app.tsx`

## 3. Command Palette

- [x] 3.1 Create `src/components/command-palette.tsx` — 1 row; global `:` key activates; `[Tab]` cycles autocomplete (`:add`, `:import <path>`, `:reset`); `[Enter]` executes; `[Esc]` dismisses; zero height when inactive
- [x] 3.2 Add global `useInput` for `:` key in `src/components/app.tsx`; wire `:reset` to `client.reset()` + toast; render `<CommandPalette>` below `<QueryRepl>`
- [x] 3.3 Add hint row to `src/components/status-bar.tsx`: `[:]command  [r]reset` in gray; update `STATUS_BAR_HEIGHT` in `src/components/app.tsx` from 3 to 4

## 4. Memory Form

- [x] 4.1 Create `src/components/memory-form.tsx` — fields: content (multiline), tier (`[Tab]` toggle: episodic cyan / semantic blue), category (`[Tab]` cycle: 👤/🌍/🎯/🤖), importance (`[←][→]` 1–5 stars → 0.2–1.0), tags (comma-separated), episodeSummary (single line); `[Tab]` advances fields; `[Enter]` on last field saves; `[Esc]` cancels; props: `client`, `onSave(id)`, `onCancel`, `onError`
- [x] 4.2 Add `write` state to `ReplState` in `src/components/query-repl.tsx`; render `<MemoryForm>` when active; on save → success toast + idle; on cancel → idle; add `onEnterWrite` prop
- [x] 4.3 Wire `:add` palette command to `onEnterWrite` in `src/components/app.tsx`

## 5. MD Import

- [x] 5.1 Create `src/lib/md-parser.ts` — `parseMemoryFile(content: string): ParsedMemory[]`; split on `\n---\n`; parse frontmatter (`tier`, `category`, `importance`, `tags`); unknown keys ignored; missing keys → undefined; returns `{ data, options }[]`
- [x] 5.2 Add unit tests for `md-parser.ts`: single block; multiple blocks; missing frontmatter defaults; unknown keys ignored; empty file returns `[]`
- [x] 5.3 Add `import-preview` state to `ReplState` in `src/components/query-repl.tsx`; render preview list (up to 10 rows, 60-char truncated); show total count and overflow if >10; `[Enter]` bulk-inserts (structured → N × `insertMemory`, free-text → `importText`); `[Esc]` returns to idle; toast on completion
- [x] 5.4 Wire `:import <path>` palette command in `src/components/app.tsx`: read file via `fs.readFileSync`; detect `---` presence; structured → `parseMemoryFile()` → `import-preview` with entries; free-text → `import-preview` with raw text flag; invalid path → toast error

## 6. Recent Memories Browser

- [x] 6.1 Add internal tab state (`stats` | `memories`) to `src/components/stats-pane.tsx`; `[s]`/`[m]` keys when pane focused; tab header shows active tab in cyan
- [x] 6.2 Implement memories view in `src/components/stats-pane.tsx`: scrollable list of 20 records; `↑↓` navigate; `[Enter]` expand detail inline; `[Esc]` collapse; row format: `{n}  {tier}  {icon}  {data truncated 40 chars}  {stars}`; category icons: 👤 🌍 🎯 🤖; importance stars ☆–★; fetch on tab activation and after successful `insertMemory`

## 7. Cleanup & Review

- [x] 7.1 Run full test suite for memex-tui; fix any failures
- [x] 7.2 Check for linter/type errors and fix
- [x] 7.3 Review full diff; remove any unnecessary comments
