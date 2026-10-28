# Homework Management Tool — Architecture

Status: draft
Companion to: `_docs/plan.md`

## 1. Overview

A single-page web app. No backend, no accounts, no network calls at runtime. All task data lives in the browser.

| Concern | Decision |
|---|---|
| Delivery | Static SPA, prebuilt assets |
| Rendering | Client-side only |
| Persistence | IndexedDB |
| AI features | Local rules and browser APIs only |
| Runtime dependencies | React, React DOM, Zustand, idb, Zod, Tailwind CSS |
| Tooling | Vite, TypeScript, Vitest, Playwright, ESLint, Prettier |
| Deploy target | Static host (GitHub Pages, Netlify, or Cloudflare Pages) |

## 2. Stack

| Layer | Choice |
|---|---|
| Build | Vite |
| Language | TypeScript, `strict: true` |
| UI | React (function components, hooks) |
| Styling | Tailwind CSS |
| Client state | Zustand |
| Validation | Zod |
| Storage | IndexedDB via `idb` |
| Offline/app shell | `vite-plugin-pwa` |
| Unit tests | Vitest + React Testing Library |
| E2E tests | Playwright (Chromium only) |
| Lint/format | ESLint flat config + Prettier |

No router. One screen with dialog overlays.

## 3. Runtime layers

```
UI (components)
   ↓ actions / selectors
Store (Zustand)
   ↓
Domain (task model, suggestion engine, filters)
   ↓
Data (repositories, IndexedDB, export/import)
```

Rules:

- Components read from the store and dispatch actions. Components never touch IndexedDB.
- All IndexedDB access is confined to `src/data/`.
- Domain functions are pure and framework-free.
- No component performs validation. Validation happens at the store boundary with Zod.

## 4. Project structure

```
src/
  main.tsx
  App.tsx
  components/
    CaptureBar.tsx
    FilterBar.tsx
    TaskList.tsx
    TaskItem.tsx
    CategoryBadge.tsx
    PriorityBadge.tsx
    VoiceButton.tsx
    EmptyState.tsx
    Toast.tsx
    dialogs/
      EditTaskDialog.tsx
      DataDialog.tsx
  store/
    taskStore.ts
    selectors.ts
  domain/
    task.ts
    categories.ts
    suggest.ts
    filters.ts
    validate.ts
  data/
    db.ts
    taskRepository.ts
    settingsRepository.ts
    exportImport.ts
  voice/
    types.ts
    webSpeech.ts
  lib/
    id.ts
    text.ts
    format.ts
  styles/
    index.css
```

## 5. Data model

### Task

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | `crypto.randomUUID()` |
| `text` | `string` | Trimmed, 1–2000 chars |
| `category` | `CategoryId` | Current category |
| `priority` | `"low" \| "medium" \| "high"` | Current priority |
| `status` | `"open" \| "done"` | |
| `source` | `"text" \| "voice" \| "paste"` | Capture channel |
| `createdAt` | ISO string (UTC) | Immutable |
| `updatedAt` | ISO string (UTC) | Any mutation |
| `completedAt` | ISO string (UTC) \| `null` | Set on complete, cleared on reopen |
| `categorySource` | `"suggested" \| "user"` | Provenance |
| `prioritySource` | `"suggested" \| "user"` | Provenance |

Invariants:

- `createdAt <= updatedAt`.
- `status === "done"` if and only if `completedAt !== null`.
- `source` never changes after creation.
- Provenance fields flip to `"user"` on manual change and never revert.

### Category

Static config in `src/domain/categories.ts`.

| Field | Type | Notes |
|---|---|---|
| `id` | `CategoryId` | Stable key, stored on tasks |
| `label` | `string` | Display text |
| `color` | `string` | Token name, not raw hex |
| `keywords` | `string[]` | Used by the suggestion engine |

Default set: `work`, `personal`, `home`, `errands`, `health`, `learning`, `admin`, `other`.
`other` is the fallback and has no keywords.

### Settings

| Field | Type | Default |
|---|---|---|
| `schemaVersion` | `number` | `1` |
| `sort` | `"newest" \| "oldest"` | `"newest"` |
| `showCompleted` | `boolean` | `false` |
| `voiceLocale` | `string` | `"en-US"` |

## 6. Storage

- Database: `hm`, version `1`.
- Object store `tasks`, `keyPath: "id"`, indexes `byStatus`, `byCreatedAt`.
- Object store `meta`, `keyPath: "key"` — holds `settings` and `schemaVersion`.
- Every task read for rendering goes through a single in-memory load at boot. The store is the render source of truth after hydration.
- Writes are optimistic: update store, persist, and revert with a toast on failure.
- Draft text in the capture field is mirrored to `sessionStorage` under `hm.draft` and cleared on save.
- Deleting a task removes it from IndexedDB immediately; the undo toast holds the record in memory for 6 seconds and re-inserts it with the same `id` on undo.
- No migration framework. Schema changes bump the DB version with an inline upgrade function in `src/data/db.ts`.

## 7. Capture flow

1. Input accepts text, paste, or voice transcript.
2. Input normalization: trim, collapse internal whitespace runs, strip surrounding quote characters, reject empty, cap at 2000 chars.
3. Paste is treated as text capture with `source: "paste"`. A multi-line paste is saved as exactly one task; newlines are preserved in `text` and no split prompt is shown.
4. `suggest(text)` returns category, priority, and confidence.
5. Task is created with suggested values and `source` set, and inserted at the top of the list.
6. Input clears. Focus returns to the input.
7. Enter saves, Shift+Enter inserts a newline.

Suggestion application is synchronous. The task is visible before the IndexedDB write resolves.

## 8. Suggestion engine

Pure function in `src/domain/suggest.ts`, no I/O, no async.

```
suggest(text: string): {
  category: CategoryId,
  priority: Priority,
  confidence: number
}
```

Category scoring:

- Normalize: lowercase, strip punctuation, tokenize on whitespace.
- Match category keywords as whole words or multi-word phrases.
- Score = sum of matched keyword weights; longer phrase matches outweigh single tokens.
- Highest score wins. Ties resolve to `other`. Zero matches resolve to `other`.
- `confidence` = winning score normalized against total matched score, clamped to `0–1`.

Priority scoring:

- High: urgency markers (`urgent`, `asap`, `today`, `now`, `deadline`, `broken`, `blocker`, `before <time>`).
- Low: deferral markers (`someday`, `maybe`, `later`, `eventually`, `when possible`).
- Default: `medium`.
- High beats low when both match.

Confidence below `0.35` keeps the category as `other` and the priority as `medium`.

Matching weights: two-word phrase `3`, single token `1`.

Default keyword table:

| Category | Keywords |
|---|---|
| `work` | meeting, standup, sprint, ticket, client, stakeholder, manager, colleague, report, deck, presentation, proposal, contract, review, demo, interview, hire, invoice, qbr, okr |
| `personal` | call mom, call dad, family, friend, birthday, gift, vacation, trip, hobby, journal, meditation, haircut, book club |
| `home` | laundry, dishes, trash, vacuum, clean, declutter, repair, fix, plumber, electrician, paint, furniture, garden, mow, plants, cat, dog, litter |
| `errands` | groceries, grocery, shop, buy, store, pharmacy, pickup, drop off, return, package, post office, bank, atm, oil change, dry cleaning, dmv, mail |
| `health` | doctor, dentist, gym, workout, yoga, run, prescription, refill, therapy, sleep, vitamins, physio, blood test, insurance |
| `learning` | study, homework, course, class, exam, quiz, lecture, assignment, notes, practice, tutorial, certification, paper, thesis |
| `admin` | renew, license, passport, tax, taxes, bill, pay, subscription, cancel, form, paperwork, registration, visa, refund, warranty |
| `other` | — |

The engine is exposed behind an interface so an alternative implementation can replace it without touching the store or UI.

## 9. Voice capture

- v1 provider: Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`). This is the only provider in v1.
- Mode: single utterance, `interimResults: true`, `continuous: false`, locale from settings.
- Interim transcript streams into the capture field; the final transcript replaces it.
- On recognition end with non-empty text, the normal capture flow runs. `source: "voice"`.
- On empty result, the field returns to its previous content.
- Errors (`not-allowed`, `no-speech`, `network`, `aborted`) map to distinct inline messages. `not-allowed` persists a disabled state until the user retries.
- Capability check runs at mount. If the API is absent, the voice button is not rendered and voice is listed as unavailable in the Data dialog.
- Audio is never recorded, stored, or uploaded by the app. The browser's own implementation of the API may transmit audio to the vendor's speech service; `DataDialog` discloses this next to the voice availability line.

Provider boundary: `voice/types.ts` defines a `TranscriptionProvider` interface with `start`, `stop`, `onResult`, `onError`, `isSupported`. `webSpeech.ts` is the only implementation in v1.

## 10. UI structure

Single screen, top to bottom:

1. Header — app name, task counts (`open`, `done`), overflow menu.
2. CaptureBar — textarea, voice button, save button, character counter past 1800 chars.
3. FilterBar — category, priority, status. Filters combine with AND.
4. TaskList — sorted per settings, grouped by nothing.
5. EmptyState — distinct copy for "no tasks" and "no matches for filters".

TaskItem:

- Checkbox toggles status.
- Text is click-to-edit inline; Enter commits, Escape cancels.
- Category and priority are dropdowns or chip pickers.
- Delete is immediate, with an undo toast.
- Completed tasks render with strikethrough and reduced emphasis.
- `categorySource === "suggested"` renders a subtle marker until changed.

Dialogs: `EditTaskDialog` (long-text edit), `DataDialog` (export, import, voice availability, storage usage).

Filters live in the store and reset to defaults on reload.

## 11. Export and import

- Export writes a JSON file `hm-tasks-<ISO date>.json`:

```
{ "format": "hm.tasks", "version": 1, "exportedAt": "...", "tasks": [...], "settings": {...} }
```

- Import validates with Zod before touching storage.
- Import modes: `replace` (clear then insert) and `merge` (insert unknown ids, keep the record with the newer `updatedAt` on conflict).
- Import reports counts of added, updated, and skipped records.
- Unknown category ids fall back to `other`; unknown priorities fall back to `medium`.
- Malformed files are rejected with a single error message and no partial writes.

## 12. PWA and offline

- `vite-plugin-pwa`, `registerType: "autoUpdate"`.
- Precache: app shell, JS, CSS, fonts.
- Manifest: name, short name, icons (192/512, maskable), `display: "standalone"`, theme colors.
- No runtime caching of API requests — there are none.
- Update available: non-blocking toast with a reload action.
- App fully functional offline after first load.

## 13. Accessibility

- All actions reachable by keyboard. Capture input is the initial focus target.
- `aria-live="polite"` region announces "Task saved", "Task deleted", "Task restored".
- Checkboxes are real `input[type=checkbox]` with labels.
- Category and priority are conveyed by text, not color alone.
- Focus returns to the capture input after save and to the edited row after commit/cancel.
- Visible focus rings on every interactive element.
- Dialogs trap focus and close on Escape.

## 14. Testing

| Level | Coverage |
|---|---|
| Unit (Vitest) | `suggest`, `filters`, normalization, Zod schemas, export/import merge logic |
| Component (RTL) | CaptureBar save behavior, TaskItem edit/complete/delete, FilterBar combinations, undo toast |
| Repository (Vitest + fake-indexeddb) | CRUD, boot hydration, upgrade path |
| E2E (Playwright) | Capture → appears → complete → filter → reload persists → export/import round trip |

Voice is tested through a stub `TranscriptionProvider`. No test depends on real speech recognition.

## 15. Performance budgets

| Metric | Target |
|---|---|
| Capture to visible task | < 50 ms |
| Filter change to rendered list | < 50 ms |
| Initial JS bundle (gzip) | < 150 KB |
| Lighthouse performance (mobile) | >= 90 |
| Lighthouse PWA installable | pass |

## 16. Browser support

- Chrome, Edge, Safari: text, paste, voice.
- Firefox: text, paste.
- Evergreen versions only. No IE, no polyfills beyond what Vite emits.

## 17. Build and deploy

- `npm run build` emits `dist/`.
- Static hosting only. No server runtime, no environment variables, no secrets.
- `base` in Vite config is configurable for subpath hosting.
- `npm run preview` for local production checks.

## 18. Phases

| Phase | Scope |
|---|---|
| 1 | Scaffold, data layer, text capture, task list, complete/delete, filters |
| 2 | Inline edit, suggestion engine, category/priority controls, undo toast |
| 3 | Voice capture via Web Speech API |
| 4 | PWA, export/import, multi-tab sync via `BroadcastChannel`, accessibility pass |

## 19. Non-goals

- Due dates, reminders, recurring tasks.
- Accounts, authentication, cross-device sync.
- Server-side storage or APIs.
- External AI APIs.
- Automatic task execution, subtasks, next-step planning.
- Telegram, WhatsApp, or email capture entry points.
- Search, tags, attachments, projects.

## 20. Decision log

| Date | Decision | Value |
|---|---|---|
| 2026-10-27 | Default categories | `work`, `personal`, `home`, `errands`, `health`, `learning`, `admin`, `other` |
| 2026-10-27 | Voice provider | Web Speech API only; `TranscriptionProvider` boundary retained for a later Whisper adapter |
| 2026-10-27 | Multi-line paste | Saved as one task, newlines preserved, no split prompt |
| 2026-10-28 | Scaffold tooling | React 19 + Vite 8 + Vitest 5; one `tsconfig.json` (`strict`, `noEmit`) covering `src` and the Vite/Vitest configs; jsdom with explicit Vitest imports (`globals: false`); `npm run test` is a single run |
| 2026-10-28 | Prettier scope | Code and config only; `*.md` is ignored in `.prettierignore` because table padding and hard-wrapping churn docs that are reviewed as prose |
