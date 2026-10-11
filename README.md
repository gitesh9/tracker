# Ascend — Personal Growth & Velocity Tracker

**Ascend** is a browser-installable Progressive Web App (PWA) designed for personal growth, habit mastery, goal velocity tracking, and behavioral self-awareness. Built with a modern React 19 + TanStack + Supabase stack, Ascend offers a frictionless experience with an aurora dark aesthetic, soundscapes, deep analytics, and offline-first cloud sync.

---

## 🌟 Key Features & Capabilities

- 🎙️ **Voice Quick-Add (Web Speech API)**: Dictate tasks hands-free; the NLP parser auto-extracts priority (`p1`/`p2`/`p3`), duration (`45m`), cadence (`daily`/`3x/week`), and domain.
- 🌳 **Interactive Visual Growth Tree (`/tree`)**: Organic SVG skill tree where branches thicken and leaves blossom across 4 life pillars (_Focus, Health, Career, Mindset_), with full **Custom Date Range** filtering and high-res image export.
- 📊 **Multi-Timeframe Insights & Procrastination Analytics (`/insights`)**: Dynamic trend charts (Area, Bar, Line), domain pie charts, weekday rhythm radar charts, 24-hour focus distribution, consistency heatmaps, and delay root-cause breakdowns.
- 🔮 **Weekly AI Retrospective & Smart Scheduling**: Automated weekly recap synthesizing momentum, analyzing deferral bottlenecks, suggesting timetable adjustments, and recommending prime focus blocks based on peak productivity hours.
- ⏱️ **Focus Timer & Native Ambient Audio (`/focus`)**: Pomodoro (25/5), Deep Work (50/10), and Sprint (90m) timers integrated with synthesized **Alpha Waves (10Hz Binaural Beats), Soft Rain, Forest Stream, and Pink Noise**.
- 👥 **Team & Accountability Circles (`/team`)**: Privacy-preserving squads, team sprint challenges, and one-tap cheers (`🔥`) without exposing private notes.
- 🎯 **Goal Milestone Breakdown & Definition of Done (`/goals`)**: Break long-term horizons into subtasks with explicit acceptance criteria, with one-click AI roadmap generation.
- 🏆 **Retrospective Achievements & Spotify Wrapped Cards (`/achieved`)**: Dynamic milestone review and exportable, shareable progress summary cards.
- 📅 **Calendar Export (`.ics`) & Custom Reminders**: Download/subscribe `.ics` calendar feeds for Google Calendar, Apple Calendar, and Outlook, alongside custom time-of-day notification triggers.
- ⚡ **Offline-First & Cloud Sync**: Seamless guest mode with `localStorage` fallback + real-time Supabase cloud sync upon login.
- 🤖 **Toggleable AI Workspace**: Google Gemini 3.5 Flash server functions with global and granular switches.

For an exhaustive breakdown of all system capabilities, consult [FEATURES.md](./FEATURES.md).

---

## 🛠️ Tech Stack

| Layer              | Technology                                                                    |
| ------------------ | ----------------------------------------------------------------------------- |
| **Framework**      | [TanStack Start](https://tanstack.com/start) (SSR + SPA) with TanStack Router |
| **UI & Styling**   | React 19, Tailwind CSS 4, shadcn/ui primitives, Motion                        |
| **State & Data**   | TanStack Query, Supabase PostgreSQL & Auth, LocalStorage Offline Queue        |
| **Visualizations** | Recharts (Area, Bar, Line, Pie, Radar), Custom Organic SVG Renderers          |
| **Audio & Speech** | Web Audio API (real-time synthesizers), Web Speech Recognition API            |
| **AI Engine**      | Google Gemini 3.5 Flash via OpenAI-compatible server functions                |
| **PWA**            | vite-plugin-pwa (Workbox service workers with offline asset caching)          |

---

## 🚀 Quickstart & Local Development

### Prerequisites

- Node.js 20+
- npm, pnpm, or bun

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd ascend

# Install dependencies
npm install

# Start the local development server (runs on port 3000)
npm run dev

# Run lint checks
npm run lint

# Build production bundle
npm run build
```

---

## 📚 Documentation

- [FEATURES.md](./FEATURES.md) — Exhaustive catalog of all user-facing features and capabilities.
- [ARCHITECTURE.md](./ARCHITECTURE.md) — Technical architecture, database schemas, security models, and server function flows.
