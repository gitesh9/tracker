# Ascend — Agent Instructions

Keep the branch in a working state. Avoid rewriting published git history.

- Shared PageLoading and EmptyState components own calm loading and empty-screen presentation; fast route switches retain the pending delay, and reduced motion limits animations to one iteration to prevent infinite spinners accelerating.

- Remote sync resets its pull cursor and re-uploads all local rows whenever the sync identity (account id) changes — otherwise data made before sign-in, or on another device, never reaches the account.
- Browser-storage → local database mirroring only inserts missing rows — re-upserting a stale copy on each launch would overwrite changes pulled from other devices.
- The public sync endpoint refuses a registered account's id unless that account's session cookie is present — the id alone must never unlock an account's rows.
- The local database (PGlite) is the only durable copy on a device; `localDB` is an in-memory working copy hydrated from it at start — a second browser-storage copy caused stale overwrites.
- Task edits update the hydrated working copy synchronously and persist patches in per-task order; saved snapshots never replace newer UI edits, and sync only clears the exact outbox versions sent — rapid completion/undo must not revert or vanish.
- Sync conflicts merge per field using client edit times (`src/lib/sync/merge.ts`, `field_times` column) — whole-row replacement lost edits made on another device.
- Squads are shared documents on the server (`/api/public/squads`, `ascend_squads` + `ascend_squad_members`), changed only through id-tagged operations in `src/lib/squads/ops.ts` with a version check — they are excluded from per-account row sync so a member's stale copy can't overwrite teammates' changes.
- The service worker never caches dev-server module paths and matches scripts by exact URL — serving a module for a different query string broke the app.
- `src/test/server-flows.test.ts` runs the real server routes against in-memory Postgres — extend it when adding server behaviour.
- Tests run with `bun run test` (vitest, `vitest.config.ts` separate from the app's Vite config) — keep the saving, sync and schedule checks passing.
- AI goal plans are validated in `goal-plan.ts` and saved through existing task/subtask mutations; daily `frequency_days` is a date-anchored interval and `due_date` gates all cadences so future steps do not appear early.
- Goal AI uses configured direct-provider keys unchanged, or the gateway when absent; gateway helpers stay server-only. Outcome milestones are goal subtasks without task_id, require user confirmation, and alone count toward goal velocity; scheduled actions are separate because practice does not prove outcomes.
- Goal saves always upsert into the local database; optimistic working-copy presence cannot establish durable existence, otherwise first-created goals disappear on reload.
- Growth Tree derives browsable completion-based seasons deterministically from date/domain history, renders only the selected season with bounded skill-tree geometry, and keeps full counts outside SVG — no duplicate persistence or growing forest DOM, and lifetime milestones remain uncapped.
- Background reminders send payload-free Web Push (VAPID, Web Crypto) and the service worker fetches the text from `/api/public/push/pending` — avoids push-message encryption on the edge runtime.
- `/api/public/push/dispatch` only runs with `CRON_SECRET` and records each send in `ascend_push_sent` — an external scheduler may call it repeatedly without duplicates.
