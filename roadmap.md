# Ascend — Task Roadmap

## Task responsiveness and seedling (Oct 10)
- [x] Fix rapid task completion/undo and disappearing task rows
- [x] Reduce avoidable lag without removing features; verify rapid clicks and persistence (desktop/mobile, 43 regression tests)
- [x] Restore graceful empty tree with slightly smaller labels and a connected rounded trunk

## Growth Tree (Oct 10)

- [x] Restore original skill-tree design with browsable seasons and milestone blossoms, fruit and gold
- [x] Verify season boundaries, long-history performance and desktop/mobile rendering (50 years, 320/390/1280 widths; PNG sharing)
- [x] Fit the tree and full counts on desktop and mobile without clipping
- [x] Represent continued growth beyond ten years and test long-history scaling

## Current batch (user request, Sep 3)

- [x] 1. Subtasks on tasks (checklist per task: add/edit/complete/delete, progress on TaskCard)
- [x] 2. Task linking — link a task to one or multiple other tasks (related/blocked-by style)
- [x] 3. Fix revisit flicker — pages animate only on first visit
- [x] 4. Full offline support — all pages load and function without internet (cache + local persistence + queue)

## Done (previous rounds)

- Core app: Today, Goals, Focus, Tree, Insights, Calendar, Achieved, Settings, Team
- PWA manifest + service worker, badges, offline queue for task updates/focus sessions
- Premium polish rounds 1–6 across all routes

## Local-first migration (Sep 12)

- [x] Removed hosted auth/database packages; app data lives in an in-browser Postgres (PGlite) on IndexedDB
- [x] Local profile/sync-key screen replaces sign-in
- [x] Optional remote sync via DATABASE_URL (`/api/public/sync`), dormant when unset
- [x] Installable app manifest (manifest.json) + icons + offline shell

## Accounts + Neon sync (Sep 16)

- [x] Email + password sign-in/sign-up stored in Neon (`ascend_users`, `ascend_sessions`, PBKDF2 hashes, httpOnly session cookie)
- [x] Google sign-in (`/api/public/auth/google/start` + `/callback`), enabled when Google credentials are set
- [x] Login page with sign-in / create-account tabs, Google button, offline notice, "continue offline"
- [x] Sync endpoint scopes rows to the signed-in account (falls back to the device sync key)
- [ ] Google OAuth credentials to be created by the user and the callback URL registered

## Sign-in visibility + cross-device sync (Oct 8)

- [x] Header account badge (signed in / sign in / sign in again) and Settings account status
- [x] Fix cross-device sync: full upload + full pull on account change, no stale overwrite on launch, DB-clock cursor, sync on tab focus
- [ ] Online database connection (DATABASE_URL) and Google keys must be set on the copy being used — waiting on user

## Round (Oct 8, later)

- [x] Squad Circles sync across your own devices
- [x] Settings: "Last synced …" + Sync now
- [x] Field-level merge for edits from two devices
- [x] One copy of data per device (local database only)
- [x] Clean-up: removed unused files; automatic checks for saving, sync, schedules
- [x] Background push reminders (needs push keys + scheduler on the host)
- [x] Sharing a squad with other people (invite link/code, live updates, leave)
