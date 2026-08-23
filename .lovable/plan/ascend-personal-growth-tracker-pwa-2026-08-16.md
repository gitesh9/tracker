## Ascend — Personal Growth Tracker PWA

A daily-driver growth tracker with cloud sync, installable from any browser. Visual direction: deep night canvas with aurora accents (near-black #0B0E14 surfaces, teal #4FD1C5 and violet #A78BFA glows), buttery micro-interactions, and celebration bursts on completion.

## Scope of this build

Full core app: auth + cloud sync, tasks and goals, flexible cadence, carry-forward engine, focus timers, growth tree, analytics, retrospective, gamification, AI workspace, browser push, and PWA install + offline.

## Backend (Lovable Cloud)

Tables exactly as specified: `profiles`, `workspaces`, `goals`, `tasks`, `deferral_logs`, `achievements`, plus:

- `subtasks` — nested breakdown with `estimated_minutes`, `definition_of_done`, ordering
- `focus_sessions` — timer runs (task, minutes, mode, started_at) powering focus-hour charts
- `reminders` + `push_subscriptions` — scheduled reminders and web-push endpoints
- `workspace_members` — seat table so team workspaces can switch on later without a migration

Every table row is owner-scoped with row-level security tied to the signed-in user (workspace-aware policies so shared workspaces work in a later phase). A trigger creates a `profiles` row and a personal workspace on signup.

## Screens

1. **Today** — the daily driver. Quick-add bar with natural-language parsing ("gym 3x per week 7am high energy") and one-tap voice dictation. Task cards show a muted, desaturated icon while pending; tapping done triggers a spring animation, colour saturation, glow, and a particle burst. Carried-forward tasks sit in a highlighted band that asks for a one-tap delay reason (Low Energy, Scope Unclear, Blocked, Distracted, Other) before rescheduling.
2. **Goals** — goal cards with domain (Focus, Health, Career, Mindset), live velocity ring, projected completion date that recalculates as you complete ahead or behind pace, and nested subtasks each with a Definition of Done field.
3. **Growth Tree** — an animated SVG skill tree: four domain branches that thicken, gain nodes, and level up as tasks complete, with a detail panel per branch.
4. **Insights** — timeframe selector (1D / 1M / 2M / 1Y / 2Y / All-Time) driving a consistency heatmap, focus-hour distribution, and procrastination root-cause breakdown from `deferral_logs`.
5. **Achieved** — retrospective for the selected timeframe: milestones hit, tasks cleared, hours invested, rendered as shareable summary cards exportable as an image or via the share sheet.
6. **Focus** — Pomodoro and stopwatch, launchable from any task, logging to `focus_sessions`.
7. **Settings** — global AI toggle, per-task AI toggles, notification permissions and reminder times, streak freezes, install prompt.

## Mechanics

- **Flexible cadence**: Daily, N× per week, or specific weekdays. Streaks evaluate against the cadence, so allowed skip days never break a streak or trigger carry-forward.
- **Velocity**: completion pace vs. required pace recomputes `projected_completion_date` on every completion.
- **Streaks**: animated counter, earnable streak freezes auto-consumed on a missed day.
- **Badges**: milestone unlocks written to `achievements`, revealed with a celebratory modal.

## AI workspace (toggleable)

Server-side calls through the Lovable AI gateway, gated by the global switch and each task's `is_ai_enabled`:

- Timetable generator — arranges pending priorities into energy-aligned blocks
- Subtask breakdown — decomposes a goal into sequential steps, each with a Definition of Done
- Procrastination diagnostics — behavioural insight from deferral history

With AI off, every screen stays fully functional; AI panels simply disappear.

## Notifications & PWA

- Browser push for upcoming, procrastinated, and easily-forgotten tasks, plus in-app toasts; a scheduled job sends the daily/weekly digest as a push. (Email digests are out of scope for this build.)
- Installable manifest with Ascend icons, standalone display, aurora theme colour.
- Offline-first: generated service worker caches the app shell and assets, local queue holds completions made offline and syncs on reconnect. Offline behaviour is only active in the published app, not the editor preview.

## Technical notes

- TanStack Start routes, server functions for all AI and privileged work, TanStack Query for reads with optimistic completion updates.
- Design tokens in `src/styles.css` (oklch): night surfaces, aurora teal/violet accents, glow shadows, gradient tokens — no hardcoded colours in components.
- Motion for React drives spring interactions, list reordering, and celebration bursts; animations respect reduced-motion.
- Per-route SEO metadata; install and push permission prompts are non-blocking.

## Build order

1. Cloud enablement, schema, RLS, auth screen
2. Today view, quick-add, completion celebration, carry-forward, streaks
3. Goals, subtasks, Definition of Done, velocity
4. Focus timers and session logging
5. Growth tree, insights, retrospective, badges
6. AI workspace and toggles
7. Push notifications, PWA install and offline