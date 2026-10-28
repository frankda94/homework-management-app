# Homework Management Tool — Scope Draft

## Goal
Build a lightweight tool to capture small tasks quickly from text, voice, or pasted messages, then categorize and prioritize them.

## Confirmed decisions

- **Primary purpose:** Fast task capture.
- **Capture inputs:** Text, voice, and pasted/shared text such as messages or emails.
- **Initial platform:** Web app accessible through a browser on desktop and phone.
- **Capture behavior:** Save tasks immediately, then categorize them.
- **Categorization:** Suggests a category, and the user can change it quickly.
- **Priority:** Suggests a priority, and the user can change it.
- **Task management:** Edit, delete, change category or priority, and mark tasks as completed.
- **Dates and reminders:** No dates or reminders in the initial scope.
- **Task view:** One list with filters for category, priority, and status.
- **Storage:** Local-only, using browser storage.

## Expected basic workflow

1. The user enters text, records voice, or pastes content.
2. Voice input is transcribed into text.
3. The task is saved immediately so capture stays fast.
4. Suggests a category and priority.
5. The user can accept or change those suggestions.
6. The task appears in the main list.
7. The user can filter, edit, delete, or complete tasks.

## Initial scope boundaries

### Included
- Fast capture from text, voice, and pasted content.
- Immediate task saving.
- category and priority suggestions using values by default.
- Manual changes to category and priority.
- Task list and filters by category, priority, and status.
- Edit, delete, and complete actions.
- Local browser storage.

### Excluded for now
- Due dates and reminders.
- Cloud accounts and cross-device synchronization.
- Automatic execution of tasks.
- AI-generated subtasks or next-step planning.
- External API-based AI.
- Integrations with Telegram, WhatsApp, or email as separate capture entry points.

## Open questions

2. **How will voice capture work?** Decide whether to use browser speech recognition or a local speech-to-text model.
3. **What categories should be available by default?**
4. **Should tasks be stored only in the current browser profile, or should export/import be supported for backups?**
5. **What frontend and implementation stack should be used?**

## Key product principle
Minimize the time between thinking of a task and saving it. Should help organize tasks without blocking capture or making the workflow complicated.
