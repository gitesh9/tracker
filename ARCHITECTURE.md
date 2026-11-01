# Ascend — Architecture & System Documentation

## 1. System Overview

**Ascend** is an offline-first Progressive Web App (PWA) designed for habit consistency, milestone deconstruction, focus tracking, and behavioral analytics. The application is built on a full-stack React 19 + TanStack Start framework integrated with Supabase PostgreSQL, Google Gemini 3.5 Flash server functions, and native browser APIs (Web Audio, Web Speech, Service Workers).

---

## 2. Technical Stack

| Layer                   | Technology                                   | Purpose                                                          |
| ----------------------- | -------------------------------------------- | ---------------------------------------------------------------- |
| **Framework**           | [TanStack Start](https://tanstack.com/start) | Full-stack React SSR + client-side routing                       |
| **Routing**             | TanStack Router                              | Type-safe, file-based routing system                             |
| **Styling & Design**    | Tailwind CSS 4, shadcn/ui, Motion            | Aurora dark theme tokens, glassmorphism, micro-interactions      |
| **Data Fetching**       | TanStack Query v5                            | Reactive cache management, optimistic updates, offline hydration |
| **Database & Auth**     | Supabase (PostgreSQL + RLS)                  | Real-time multi-device sync, row-level security                  |
| **Data Visualizations** | Recharts & Custom SVGs                       | Trend area/bar/line charts, domain radars, growth trees          |
| **AI Intelligence**     | Google Gemini 3.5 Flash                      | Server functions for schedules, goal breakdown, retrospectives   |
| **Browser Engines**     | Web Audio API & Web Speech API               | Embedded soundscapes (binaural beats, rain) and voice quick-add  |
| **PWA & Offline**       | vite-plugin-pwa (Workbox)                    | Offline service worker caching and installability                |

---

## 3. Directory Layout

```
├── FEATURES.md                   # Comprehensive feature & capability specification
├── ARCHITECTURE.md               # Technical architecture & design document
├── README.md                     # Project overview and developer onboarding
├── eslint.config.js              # ESLint 9 configuration
├── package.json                  # Dependencies, scripts, and build targets
├── vite.config.ts                # Vite build and plugin setup
│
├── public/
│   ├── icons/                    # PWA launcher icons (192x192, 512x512)
│   └── robots.txt                # Search index directives
│
├── src/
│   ├── main.tsx                  # React DOM entry point
│   ├── router.tsx                # TanStack Router & QueryClient instantiation
│   ├── routeTree.gen.ts          # Auto-generated type-safe route manifest
│   ├── styles.css                # Tailwind base, aurora design variables & tokens
│   │
│   ├── components/
│   │   ├── ascend/               # Domain-specific components
│   │   │   ├── BadgeModal.tsx         # Achievement unlock showcase
│   │   │   ├── BadgeWatcher.tsx       # Automatic milestone unlock listener
│   │   │   ├── CelebrationBurst.tsx   # Particle celebration effects on complete
│   │   │   ├── DelayDialog.tsx        # 1-tap procrastination reason logger
│   │   │   ├── Heatmap.tsx            # Annual consistency matrix
│   │   │   ├── ProgressRing.tsx       # SVG circular velocity indicator
│   │   │   ├── QuickAdd.tsx           # NLP and Web Speech voice input
│   │   │   ├── RangeSelector.tsx      # Date range picker & custom calendar
│   │   │   ├── StreakChip.tsx         # Active streak & freeze counter
│   │   │   ├── SyncWatcher.tsx        # Cloud vs. local sync status indicator
│   │   │   ├── TaskCard.tsx           # Task card with priority, timer & carry-forward
│   │   │   └── TimeframeSelector.tsx  # Dynamic timeframe filter
│   │   └── ui/                   # Headless accessible shadcn primitives
│   │
│   ├── lib/
│   │   ├── utils.ts              # Class merging (`cn`) and formatting helpers
│   │   ├── ascend/
│   │   │   ├── ai.functions.ts   # Server functions (Timetable, Breakdown, Retro, Diagnostics)
│   │   │   ├── badges.ts         # Achievement criteria definitions
│   │   │   ├── cadence.ts        # Streak algorithms, carry-forward math, date arithmetic
│   │   │   ├── ics.ts            # RFC 5545 iCalendar feed generator
│   │   │   ├── icons.ts          # Lucide icon mapping for task visual states
│   │   │   ├── notifications.ts  # Web notification scheduling & permission handling
│   │   │   ├── offline.ts        # Mutation queue & localStorage fallback
│   │   │   ├── queries.ts        # TanStack Query custom hooks for Supabase CRUD
│   │   │   ├── quick-add.ts      # Natural language string parser
│   │   │   ├── range.ts          # Timeframe range calculations & bucketing
│   │   │   ├── soundscapes.ts    # Web Audio API real-time audio synthesizers
│   │   │   └── types.ts          # Domain TypeScript type definitions
│   │
│   └── routes/
│       ├── __root.tsx            # HTML shell, global audio/sync providers, error boundaries
│       ├── auth.tsx              # Sign-in & sign-up authentication page
│       ├── index.tsx             # Public landing & feature tour
│       └── _authenticated/
│           ├── route.tsx         # Authenticated layout guard & sidebar navigation
│           ├── today.tsx         # Daily task list, energy timetable & voice quick-add
│           ├── goals.tsx         # Long-term goals & nested subtasks with definition of done
│           ├── focus.tsx         # Pomodoro / Sprint focus timers with ambient soundscapes
│           ├── tree.tsx          # Growth Tree SVG visualization with custom range picker
│           ├── calendar.tsx      # Calendar view, month grid & .ics export
│           ├── insights.tsx      # Multi-metric charts, delay analysis & weekly AI retrospective
│           ├── team.tsx          # Accountability squads, sprint challenges & cheers
│           ├── achieved.tsx      # Milestone history & exportable progress cards
│           └── settings.tsx      # Profile, AI toggles, custom reminders, calendar sync & sign-out
```

---

## 4. Architectural Data & Execution Flows

```
[Browser Client]
       │
       ├── Web Speech Recognition (Voice Quick-Add) ──► NLP Parser (quick-add.ts)
       │
       ├── Web Audio API (soundscapes.ts) ────────────► Local Audio Output (Binaural, Rain)
       │
       ├── TanStack Query (queries.ts)
       │       │
       │       ├── [Online]  ──► Supabase PostgreSQL (via Browser SDK + RLS)
       │       └── [Offline] ──► localStorage Queue (offline.ts) with Auto-Replay
       │
       └── TanStack Start Server Functions (ai.functions.ts)
               │ (requireSupabaseAuth middleware)
               └──► Google Gemini 3.5 Flash Gateway
```

---

## 5. Database Schema (Supabase PostgreSQL)

| Table            | Primary Columns                                                                                                                                                        | Purpose                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `profiles`       | `id`, `email`, `current_streak`, `longest_streak`, `streak_freezes`, `ai_enabled`                                                                                      | User metadata, consistency metrics, and AI preferences |
| `tasks`          | `id`, `user_id`, `goal_id`, `title`, `domain`, `priority`, `energy_level`, `frequency_type`, `completed_dates`, `estimated_minutes`, `due_date`, `carry_forward_count` | Core task and habit tracking entities                  |
| `goals`          | `id`, `user_id`, `title`, `domain`, `target_days`, `projected_completion_date`, `is_completed`                                                                         | High-level long-term targets                           |
| `subtasks`       | `id`, `goal_id`, `title`, `definition_of_done`, `estimated_minutes`, `is_completed`                                                                                    | Concrete milestone steps under parent goals            |
| `deferral_logs`  | `id`, `task_id`, `user_id`, `reason_category`, `notes`, `logged_at`                                                                                                    | Root-cause logs for postponed tasks                    |
| `focus_sessions` | `id`, `user_id`, `task_id`, `minutes`, `mode`, `started_at`                                                                                                            | Completed focus sessions and timer records             |
| `reminders`      | `id`, `user_id`, `label`, `remind_at`, `is_enabled`                                                                                                                    | Custom scheduled time-of-day notification triggers     |
| `achievements`   | `id`, `user_id`, `badge_key`, `unlocked_at`                                                                                                                            | Unlocked milestone badges                              |

---

## 6. AI Workspace Server Functions

All AI operations are encapsulated in secure server functions in `src/lib/ascend/ai.functions.ts`:

1. **`generateTimetable`**: Takes pending tasks, wake time, and sleep time to synthesize energy-aligned time blocks.
2. **`breakdownGoal`**: Decomposes a target into 5-8 sequential milestones with explicit "Definition of Done" acceptance criteria.
3. **`diagnoseProcrastination`**: Evaluates historical delay categories and suggests behavioral interventions.
4. **`generateWeeklyRetrospective`**: Analyzes weekly completion velocity, peak focus hours, and domain allocation to provide a Sunday recap and timetable adjustments.

---

## 7. Soundscapes & Web Audio Engine

Ambient sounds in `src/lib/ascend/soundscapes.ts` are generated procedurally using the browser's `AudioContext`:

- **10Hz Alpha Waves**: Dual sine wave oscillators with a 10Hz frequency differential create an auditory binaural beat inducing relaxed focus.
- **Pink Noise**: Filtered white noise algorithm attenuating high frequencies at 3dB/octave.
- **Rain & Stream**: Multi-node low-pass and band-pass filters creating realistic atmospheric masking without streaming bandwidth overhead.
