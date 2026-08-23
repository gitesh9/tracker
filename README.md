# Ascend: Daily Growth

Build a browser-installable Progressive Web App (PWA) called "Ascend"—a personal growth tracker with an award-winning, world-class UI/UX that feels exceptionally satisfying, effortless, and delightful to use every single day.

---

### 1. UI/UX & Design Directive

* **Award-Winning Aesthetic & Feel:** Deliver an award-winning, state-of-the-art interface with buttery-smooth micro-interactions, tactile animations, fluid transitions, and a premium visual aesthetic.

* **Effortless Interaction:** Ensure all logging, navigation, and review workflows feel completely frictionless and engaging so users genuinely look forward to opening and filling it out daily.

---

### 2. Core Functional Requirements

#### A. Task Management, Flexible Cadence & Visual States

* **Effortless Quick-Add:** Fast natural-language input with one-tap voice-to-text logging to capture tasks in seconds.

* **Custom Task Logos/Icons:** Every task has an assigned icon/logo that displays in a desaturated, muted/greyed-out state while pending, and bursts with a vibrant celebration effect and glow once marked done.

* **Flexible Schedules & Velocity Forecasting:** 

  * Support flexible cadences (e.g., "Daily", "3x per week", or custom weekdays).

  * Allowed skip days do not break streaks or trigger carry-forward alerts.

  * Completing a flexible task ahead of pace dynamically recalculates and accelerates the estimated completion date of the parent goal.

* **Procrastination Carry-Forward Engine:**

  * Incomplete tasks that miss their target window are automatically carried forward and visually highlighted.

  * Prompt a quick 1-tap "Reason for Delay" selection (*Low Energy, Scope Unclear, Blocked, Distracted, Other*) before rescheduling.

* **Focus Tools:** Integrated Pomodoro and stopwatch timers directly on tasks.

#### B. Deep Goal Breakdown & "Definition of Done"

* **Milestone Deconstruction:** Break long-term targets (e.g., certifications, habits) into nested subtasks with estimated durations.

* **Definition of Done:** Dedicated fields on subtasks detailing the exact completion criteria required to check them off.

* **Live Velocity Tracking:** Visual progress rings reflecting how current completion pace impacts overall target timelines.

#### C. Visual Growth Tree & Multi-Timeframe Analytics

* **Timeframe Selector:** Dynamically aggregate and inspect data across **1 Day, 1 Month, 2 Months, 1 Year, 2 Years, and All-Time**.

* **Interactive Growth Tree / Flowchart:** A visual skill/personality tree mapping progress across personal domains (*Focus, Health, Career, Mindset*), where branches thicken, level up, and evolve as tasks are completed.

* **Rich Data Visualizations:** Consistency heatmaps, focus-hour distribution charts, and procrastination root-cause analytics.

#### D. "What You Achieved" Retrospective Page

* **Duration-Based Retrospective:** A dedicated section that dynamically displays all milestones, cleared tasks, and invested hours based on the currently selected timeframe (Day, Month, Year, etc.).

* **Visual Summary Cards:** Beautiful, exportable progress cards ready to share via message or email digest.

#### E. Gamification, Streaks & Reminders

* **Streaks & Protection:** Daily consistency streak counters with animated indicators and earnable "Streak Freezes".

* **Awards & Badges:** Milestone unlocks and achievement awards that make progress feel intrinsically rewarding.

* **Smart Reminders:** Push notifications and scheduled reminders for upcoming, procrastinated, or easily forgotten tasks.

* **Progress Digests:** Automated email and message summaries of recent achievements and growth stats.

#### F. AI Workspace (Fully Toggleable)

* **Toggle Controls:** Granular toggle switches per task and globally to enable or disable AI features on demand.

* **AI Timetable Generator:** Toggleable module that arranges pending priorities into energy-aligned daily time blocks.

* **AI Subtask Breakdown:** One-click decomposition of complex goals into sequential steps with definitions of done.

* **Procrastination Diagnostics:** AI-driven behavioral insights based on logged deferral patterns.

#### G. Sync, Team Readiness & Platform

* **Authentication & Cross-Device Sync:** User login with real-time cloud synchronization across all desktop and mobile browsers.

* **PWA & Offline Support:** Installable directly from the browser with offline-first local storage fallback.

* **Team Workspaces (Planned Phase):** Multi-tenant database structure supporting workspace sharing for team progress tracking.

---

### 3. Database Schema Structure (Supabase PostgreSQL)

* **`profiles`**: `id (uuid, FK auth.users)`, `email`, `current_streak (int)`, `streak_freezes (int)`, `created_at`.

* **`workspaces`**: `id (uuid)`, `name (text)`, `owner_id (uuid)`, `is_team (bool)`.

* **`goals`**: `id (uuid)`, `user_id (uuid)`, `workspace_id (uuid)`, `title (text)`, `domain (text)`, `target_days (int)`, `projected_completion_date (date)`, `is_completed (bool)`.

* **`tasks`**: `id (uuid)`, `user_id (uuid)`, `goal_id (uuid, nullable)`, `title (text)`, `icon_name (text)`, `priority (text)`, `energy_level (text)`, `frequency_type (text)`, `target_days_per_week (int)`, `completed_dates (date[])`, `estimated_minutes (int)`, `definition_of_done (text)`, `is_completed (bool)`, `is_ai_enabled (bool)`, `due_date (date)`, `carry_forward_count (int)`.

* **`deferral_logs`**: `id (uuid)`, `task_id (uuid)`, `user_id (uuid)`, `reason_category (text)`, `notes (text)`, `logged_at (timestamp)`.

* **`achievements`**: `id (uuid)`, `user_id (uuid)`, `badge_key (text)`, `unlocked_at (timestamp)`.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e0221151-3c60-41ca-9962-47c67d045cb4).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
