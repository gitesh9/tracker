# Ascend — Architecture & Project Documentation

## Overview

**Ascend** is a Progressive Web App (PWA) for personal growth tracking — habits, goals, focus sessions, streaks, and procrastination analytics — built with a modern React + TanStack + Supabase stack.

---

## Tech Stack

| Layer         | Technology                                                     |
| ------------- | -------------------------------------------------------------- |
| Framework     | [TanStack Start](https://tanstack.com/start) (SSR + SPA)      |
| UI            | React 19, Tailwind CSS 4, shadcn/ui (New York style), Motion   |
| Routing       | TanStack Router (file-based, code-generated route tree)        |
| Data          | TanStack Query, Supabase (Postgres + Auth)                     |
| AI            | Google Gemini 3.5 Flash via Lovable AI Gateway (server-side)   |
| PWA           | vite-plugin-pwa (Workbox, generateSW strategy)                 |
| Build         | Vite, `@lovable.dev/vite-tanstack-config` (wraps Vite plugins) |
| Linting       | ESLint 9, Prettier                                             |
| Package Mgr   | pnpm (bun lockfile also present)                               |
| Deployment    | Cloudflare (via Nitro, configured by the Vite config wrapper)  |

---

## Directory Structure

```
tracker/
├── AGENTS.md                   # Lovable sync metadata
├── bunfig.toml                 # Bun install config (supply-chain guard)
├── components.json             # shadcn/ui configuration
├── eslint.config.js            # ESLint 9 flat config
├── package.json                # Dependencies & scripts
├── tsconfig.json               # TypeScript (ES2022, Bundler resolution, strict)
├── vite.config.ts              # Vite config (delegates to @lovable.dev wrapper)
│
├── public/
│   ├── robots.txt
│   └── icons/                  # PWA icons (192, 512)
│
├── supabase/
│   ├── config.toml             # Supabase project config
│   └── migrations/             # SQL migration files
│
└── src/
    ├── start.ts                # TanStack Start entry — middleware registration
    ├── server.ts               # Custom SSR entry — error capture wrapper
    ├── router.tsx              # TanStack Router + QueryClient factory
    ├── routeTree.gen.ts        # Auto-generated route tree (do not edit)
    ├── styles.css              # Tailwind + Ascend design system tokens
    │
    ├── components/
    │   ├── ascend/             # App-specific components
    │   │   ├── BadgeModal.tsx       # Badge display modal
    │   │   ├── BadgeWatcher.tsx     # Auto-unlock badge checker
    │   │   ├── CelebrationBurst.tsx # Task completion animation
    │   │   ├── DelayDialog.tsx      # Procrastination reason picker
    │   │   ├── Heatmap.tsx          # Consistency heatmap
    │   │   ├── ProgressRing.tsx     # Circular progress indicator
    │   │   ├── QuickAdd.tsx         # Natural-language task input
    │   │   ├── RangeSelector.tsx    # Date range picker
    │   │   ├── StreakChip.tsx       # Streak counter display
    │   │   ├── SyncWatcher.tsx      # Cross-device sync indicator
    │   │   ├── TaskCard.tsx         # Task display/toggle card
    │   │   └── TimeframeSelector.tsx# Timeframe filter (1d–all)
    │   └── ui/                 # shadcn/ui primitives (50+ components)
    │
    ├── hooks/
    │   └── use-mobile.tsx      # Responsive breakpoint hook
    │
    ├── integrations/
    │   ├── lovable/
    │   │   └── index.ts        # Lovable OAuth wrapper (Google sign-in)
    │   └── supabase/
    │       ├── client.ts           # Browser-side Supabase client
    │       ├── client.server.ts    # Server-side admin client (bypasses RLS)
    │       ├── auth-attacher.ts    # Client middleware: attaches bearer token to RPCs
    │       ├── auth-middleware.ts  # Server middleware: validates auth on server fns
    │       └── types.ts            # Auto-generated Database types
    │
    ├── lib/
    │   ├── utils.ts                # cn() and general utilities
    │   ├── pwa.ts                  # SW registration (blocks Lovable preview)
    │   ├── error-capture.ts        # Global error capture (console.error wrap)
    │   ├── error-page.ts           # Static 500 HTML page
    │   ├── lovable-error-reporting.ts  # Forwards errors to Lovable editor telemetry
    │   └── ascend/
    │       ├── ai.functions.ts     # Server functions: timetable, goal breakdown, diagnostics
    │       ├── badges.ts           # Badge unlock logic
    │       ├── cadence.ts          # Date math, streak computation, frequency helpers
    │       ├── icons.tsx           # Icon mapping for tasks
    │       ├── notifications.ts    # Push notification / reminder tick
    │       ├── offline.ts          # Offline queue for mutations
    │       ├── queries.ts          # TanStack Query hooks (CRUD for all entities)
    │       ├── quick-add.ts        # NLP parser for quick-add input
    │       ├── range.ts            # Timeframe range utilities
    │       ├── types.ts            # Domain types derived from DB schema
    │       └── use-auth.ts         # useAuthUser() hook
    │
    └── routes/
        ├── __root.tsx              # Root layout (HTML shell, auth listener, error boundary)
        ├── auth.tsx                # Sign-in / sign-up page
        ├── index.tsx               # Landing page (marketing)
        └── _authenticated/
            ├── route.tsx           # Auth guard layout (redirects to /auth)
            ├── today.tsx           # Daily task view + AI timetable
            ├── goals.tsx           # Goals + subtask management
            ├── focus.tsx           # Pomodoro / focus sessions
            ├── tree.tsx            # Growth tree visualization
            ├── calendar.tsx        # Calendar heatmap view
            ├── insights.tsx        # Analytics dashboard
            ├── achieved.tsx        # Retrospective / achievements
            └── settings.tsx        # User settings
```

---

## Architecture Flow

```
Browser ──► TanStack Router (SPA navigation)
               │
               ├── Public routes: / (landing), /auth
               └── /_authenticated/* (guarded by beforeLoad → supabase.auth.getUser)
                      │
                      ├── Components read data via TanStack Query hooks (src/lib/ascend/queries.ts)
                      │       └── Supabase client (src/integrations/supabase/client.ts)
                      │
                      └── Server functions (AI features in src/lib/ascend/ai.functions.ts)
                              └── Protected by requireSupabaseAuth middleware
                              └── Call Lovable AI Gateway (OpenAI-compatible endpoint)
```

### Authentication

1. **Email/password** — handled directly by `supabase.auth.signUp` / `signInWithPassword`.
2. **Google OAuth** — routed through `@lovable.dev/cloud-auth-js` (Lovable's OAuth proxy), which sets the Supabase session after redirect.
3. **Server functions** — the client middleware (`auth-attacher.ts`) extracts the access token and sends it as an `Authorization` header; the server middleware (`auth-middleware.ts`) validates it and creates a per-request Supabase client scoped to the user.

### Data Layer

All CRUD goes through `src/lib/ascend/queries.ts`, which exports React Query hooks (`useTasks`, `useGoals`, `useProfile`, etc.) that talk directly to Supabase via the browser client. Optimistic mutations are used for task updates. An offline queue (`offline.ts`) enqueues mutations when the device is disconnected.

### AI Features (Server-Side)

Three server functions in `ai.functions.ts`:
- `generateTimetable` — arranges tasks into energy-aligned time blocks.
- `breakdownGoal` — decomposes a goal into 5–8 subtasks with definitions of done.
- `diagnoseProcrastination` — analyzes deferral patterns and suggests corrective actions.

All call the **Lovable AI Gateway** (`https://ai.gateway.lovable.dev/v1/chat/completions`) using `LOVABLE_API_KEY`.

---

## Lovable Integration Points (to be removed)

| # | File / Config                              | What it does                                        |
|---|-------------------------------------------|-----------------------------------------------------|
| 1 | `package.json`                            | `@lovable.dev/cloud-auth-js` dependency             |
| 2 | `package.json` (devDeps)                  | `@lovable.dev/vite-tanstack-config` dependency      |
| 3 | `vite.config.ts`                          | Imports `defineConfig` from Lovable wrapper          |
| 4 | `src/integrations/lovable/index.ts`       | OAuth wrapper using `@lovable.dev/cloud-auth-js`    |
| 5 | `src/routes/auth.tsx`                     | Imports & calls `lovable.auth.signInWithOAuth`      |
| 6 | `src/lib/lovable-error-reporting.ts`      | Forwards errors to Lovable editor telemetry         |
| 7 | `src/routes/__root.tsx`                   | Imports & calls `reportLovableError`                |
| 8 | `src/lib/pwa.ts`                          | Blocks SW registration on Lovable preview domains   |
| 9 | `src/lib/ascend/ai.functions.ts`          | Uses `LOVABLE_API_KEY` + Lovable AI Gateway URL     |
| 10| `bunfig.toml`                             | Exempts Lovable packages from release-age guard     |
| 11| `AGENTS.md`                               | Lovable sync instructions                           |
| 12| `.lovable/`                               | Lovable project metadata directory                  |
| 13| `supabase/client.ts`, `client.server.ts`, `auth-middleware.ts` | "Connect Supabase in Lovable Cloud" error messages |
| 14| `README.md`                               | "Built with Lovable" attribution                    |

---

## Database Schema (Supabase PostgreSQL)

| Table            | Purpose                                    |
| ---------------- | ------------------------------------------ |
| `profiles`       | User profile, streak count, streak freezes |
| `tasks`          | Habits/tasks with cadence, completion log  |
| `goals`          | Long-term goals with domain + timeline     |
| `subtasks`       | Nested steps under goals                   |
| `deferral_logs`  | Procrastination reason tracking            |
| `achievements`   | Unlocked badges                            |
| `focus_sessions` | Pomodoro / timer sessions                  |
| `reminders`      | Scheduled notifications                    |

Row Level Security (RLS) is enforced. The server admin client (`client.server.ts`) bypasses RLS for admin operations.

---

## Scripts

| Command        | Purpose                        |
| -------------- | ------------------------------ |
| `pnpm dev`     | Start Vite dev server          |
| `pnpm build`   | Production build               |
| `pnpm preview` | Preview production build       |
| `pnpm lint`    | Run ESLint                     |
| `pnpm format`  | Run Prettier                   |
