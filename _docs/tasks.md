# Homework Management Tool — Task Backlog

Derived from `_docs/plan.md` and `_docs/architecture.md`.
Each task is scoped to one working session and states the context needed to start it without reading the other tasks.

Scope changes from the first draft: tooling was merged into the scaffold, categories into the model task, settings into storage, draft persistence into capture, complete/reopen into the list, empty states into the shell, filter logic into the filter bar, inline edit with the edit dialog, export with import, and deploy with PWA. The store task was split into core/hydration and optimistic persistence/selectors because the combined work did not fit one session.

---

## 1. Scaffold the empty project with tooling and a passing test
Goal: A runnable Vite + React + TypeScript app with lint, format, typecheck, and a green test suite.
Description: Create the project skeleton with Vite, React, TypeScript (`strict: true`), and Vitest, plus the folder layout from `_docs/architecture.md` (`src/components`, `src/store`, `src/domain`, `src/data`, `src/voice`, `src/lib`, `src/styles`). Configure ESLint flat config and Prettier, add `test`, `lint`, `format`, and `typecheck` scripts, and add one smoke test that renders `App` and asserts a placeholder heading. Do not add product features yet.

## 2. Define the task model, validation schemas, and category config
Goal: A single source of truth for task data, validation, and default categories.
Description: Implement `src/domain/task.ts` with the `Task`, `CategoryId`, `Priority`, `Status`, and `CaptureSource` types, and `src/domain/validate.ts` with Zod schemas for stored tasks and newly captured tasks, including the 2000-character cap and the `status`/`completedAt` invariant. Add `src/domain/categories.ts` with the eight default categories, labels, Tailwind color tokens, and keyword lists, plus `getCategory` and `isCategoryId` helpers that fall back to `other`. Unit-test valid and invalid records and the category helpers.

## 3. Implement the category and priority suggestion engine
Goal: Pure, synchronous suggestions from raw task text.
Description: Implement `suggest(text)` in `src/domain/suggest.ts` with keyword matching: lowercase and tokenize, weight two-word phrases at 3 and single tokens at 1, resolve ties and zero matches to `other`, and compute clamped confidence. Add priority rules (urgency markers to `high`, deferral markers to `low`, default `medium`, high wins) and apply the `0.35` confidence floor. Unit-test each rule and expose the engine behind an interface so it can be replaced later.

## 4. Build the IndexedDB storage layer and repositories
Goal: Versioned persistence for tasks and settings with no UI dependency.
Description: Using `idb`, create `src/data/db.ts` opening database `hm` at version 1 with a `tasks` store (`keyPath: "id"`, indexes `byStatus` and `byCreatedAt`) and a `meta` store, plus a typed `getDb()` and an inline upgrade function. Implement `src/data/taskRepository.ts` with `getAll`, `put`, `delete`, and `clear` that validate records through Zod, and `src/data/settingsRepository.ts` with defaults (`schemaVersion: 1`, `sort: "newest"`, `showCompleted: false`, `voiceLocale: "en-US"`) and partial-save merging. Test the schema, CRUD round trips, ordering, and settings defaults with `fake-indexeddb`; all storage access stays inside `src/data/`.

## 5. Build the Zustand store and boot hydration
Goal: One in-memory source of truth for rendering.
Description: Create `src/store/taskStore.ts` holding `tasks`, `filters`, `settings`, and a `hydrated` flag, with actions for load, add, update, delete, complete, reopen, and set-filters. Hydrate once at boot from the repositories, preserve `createdAt`/`updatedAt` and the status invariant in every action, and unit-test hydration and each mutation.

## 6. Add optimistic persistence, rollback, and selectors
Goal: Fast UI updates that survive storage failures and feed the views.
Description: Wrap the store's write actions so state updates first, persistence follows, and a failed write reverts the previous state and surfaces an error. Add `src/store/selectors.ts` for the task list and open/done counts, and test the success, failure/rollback, and selector cases with a mocked repository.

## 7. Build the app shell, header counts, and empty states
Goal: The single-screen frame the rest of the UI plugs into.
Description: Set up Tailwind and `src/styles/index.css`, then build `App.tsx` as a top-to-bottom layout with header, capture area, filter area, task list, and empty state regions, using semantic landmarks and making the capture input the initial focus target. Add open and done task counts to the header from store selectors. Implement `EmptyState.tsx` with distinct copy for "no tasks yet" and "no matches for the current filters", including a clear-filters action in the second case, and test both variants and count updates.

## 8. Build the capture bar and persist its draft
Goal: Save a task from typed or pasted text in one action without losing in-progress input.
Description: Implement `CaptureBar.tsx` with a textarea, save button, and a character counter that appears past 1800 chars; normalize input by trimming, collapsing whitespace runs, and stripping surrounding quotes, then reject empty or over-2000-char text. On save, call the store's `add` with `source: "text"` (or `"paste"` for pasted multi-line content saved as one task), clear the field, and restore focus; Enter saves and Shift+Enter inserts a newline. Mirror the draft to `sessionStorage` under `hm.draft`, restore it on mount, and clear it on save, with React Testing Library coverage for save, keyboard behavior, and draft restore/clear.

## 9. Render the task list and add complete/reopen actions
Goal: Show every task with the controls needed to act on it.
Description: Implement `TaskList.tsx` and `TaskItem.tsx` to render the tasks from the store, with a labeled checkbox, task text, category and priority badges, and a delete control; completed tasks render with strikethrough and reduced emphasis. Wire the checkbox to the store's `complete` and `reopen` actions, setting `completedAt` and `status` together and bumping `updatedAt`. Test rendering, both status transitions, and preservation of the model invariant.

## 10. Add delete with an undo toast
Goal: Recover from accidental deletion without a confirmation dialog.
Description: Delete removes the task from IndexedDB immediately while holding the record in memory for six seconds. Render a toast with an Undo action that re-inserts the record with the same `id`, and announce "Task deleted" and "Task restored" through an `aria-live="polite"` region. Test the delete-then-undo path, toast expiry, and the live-region announcements.

## 11. Add filtering, sorting, and the filter bar
Goal: Narrow the task list by category, priority, and status.
Description: Create `src/domain/filters.ts` with a `Filters` type (category, priority, status, all nullable) and pure functions that apply filters with AND semantics and sort by `createdAt` in `newest`/`oldest` order, honoring `showCompleted`. Build `FilterBar.tsx` with an "all" option per control, bind it to the store's in-memory filters, and wire the filtered result into the list and the "no matches" empty state. Unit-test combined filters and sorting, and component-test individual and stacked filter selections.

## 12. Add inline text editing and the long-text edit dialog
Goal: Fix a task's wording without leaving the list, and comfortably edit long text.
Description: Make task text click-to-edit: clicking swaps in an input pre-filled with the current text, Enter commits through the store, Escape cancels, and focus returns to the row; trim and validate on commit (reject empty, cap at 2000 chars) and bump `updatedAt`. Implement `dialogs/EditTaskDialog.tsx` as a modal textarea editor opened from a task row, using the same validation and store action, trapping focus, closing on Escape and backdrop click, and restoring focus to the triggering row. Test commit, cancel, invalid input, and focus restoration for both editors.

## 13. Add category and priority pickers on each task
Goal: Let users override suggested values quickly.
Description: Add chip or dropdown controls to `TaskItem.tsx` for category and priority, using the options from `src/domain/categories.ts` and the three priority levels. On manual change, update the field, set its `*Source` flag to `"user"` permanently, and bump `updatedAt`. Show a subtle marker while `categorySource` is still `"suggested"`, and test that provenance flips and never reverts.

## 14. Add the transcription provider boundary and Web Speech adapter
Goal: A swappable voice interface with a stub for tests.
Description: Define `TranscriptionProvider` in `src/voice/types.ts` with `start`, `stop`, `onResult`, `onError`, and `isSupported`, then implement `src/voice/webSpeech.ts` over `SpeechRecognition`/`webkitSpeechRecognition` in single-utterance mode with interim results and the locale from settings. Map `not-allowed`, `no-speech`, `network`, and `aborted` to distinct error codes, and never record or store audio. Test the adapter against a fake recognition constructor.

## 15. Build the voice capture button
Goal: Turn speech into a task using the normal capture flow.
Description: Implement `VoiceButton.tsx` that checks support at mount and renders nothing when the API is absent. While listening, stream the interim transcript into the capture field; on a final non-empty transcript, run the normal save flow with `source: "voice"`, and on an empty result restore the previous field content. Show inline messages per error code, persist a disabled state after `not-allowed`, and test with a stub `TranscriptionProvider`.

## 16. Implement JSON export and import logic
Goal: Produce a backup for download and restore one safely.
Description: Add an export function to `src/data/exportImport.ts` that produces `{ format: "hm.tasks", version: 1, exportedAt, tasks, settings }`, validates it with Zod, and downloads it as `hm-tasks-<ISO date>.json`. Add an import function that parses and validates a file before any write, then applies `replace` (clear then insert) or `merge` (insert unknown ids, keep the newer `updatedAt` on conflict), falling back to `other`/`medium` for unknown values and returning added/updated/skipped counts. Reject malformed files with one error and no partial writes; unit-test the payload shape, filename, both modes, the conflict rule, and the rejection path.

## 17. Build the data dialog
Goal: One place for backup, restore, voice availability, and storage usage.
Description: Build `dialogs/DataDialog.tsx` with export, import (mode choice plus file picker), a voice availability line, and an estimated storage usage figure, including a short disclosure that the browser's speech service may transmit audio to its vendor. Trap focus, close on Escape, report import results as counts, and test the controls with mocked data functions.

## 18. Make the app installable, offline-capable, and deployable
Goal: Works offline after first load, installs as a PWA, and ships to a static host.
Description: Add `vite-plugin-pwa` with `registerType: "autoUpdate"`, precache the app shell, JS, CSS, and fonts, and provide a manifest with name, short name, 192/512 maskable icons, `display: "standalone"`, and theme colors. Show a non-blocking update toast with a reload action, verify a production build serves offline with the network disabled, and make `base` overridable for subpath hosting. Document the `build`/`preview` and static-deploy steps in `README.md` and confirm the initial bundle stays under 150 KB gzip.

## 19. Sync state across browser tabs
Goal: Keep multiple open tabs consistent.
Description: Use `BroadcastChannel` to publish task and settings mutations and apply incoming messages to the store without re-broadcasting. Handle a tab that missed messages by reloading from IndexedDB when a channel opens. Test with two store instances sharing a stubbed channel.

## 20. Complete the accessibility pass
Goal: Every action is usable by keyboard and screen reader.
Description: Audit the app for keyboard reachability, visible focus rings, labeled controls, dialog focus trapping, and text-based category and priority indicators. Ensure the live region announces save, delete, and restore, and that focus returns to the capture input after save and to the edited row after edit. Add component tests for focus movement and run an automated accessibility check on the main screen.

## 21. Add the end-to-end happy path test
Goal: Prove the core workflow works in a real browser.
Description: Write a Playwright test (Chromium only) covering capture, task appearing in the list, completing it, filtering, reloading to confirm persistence, and an export/import round trip. Use a fresh browser context per test and run it against the production preview build. Wire it into a `test:e2e` script.
