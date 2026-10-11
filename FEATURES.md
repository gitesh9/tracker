# Ascend — Complete Feature & Capability Specification

**Ascend** is a Progressive Web App (PWA) designed for personal growth, habit mastery, goal velocity tracking, and behavioral self-awareness. It combines deep psychological principles (frictionless capture, cadence flexibility, procrastination root-cause diagnosis, domain skill evolution) with a world-class aurora dark aesthetic and offline-first cloud synchronization.

---

## 1. Smart Capture & Task Management

### Natural Language Quick-Add (NLP)

- **Instant Keyword Parsing**: Type natural expressions such as _"Deep work 90 min p1 daily"_ or _"Gym 3x per week 45m career"_ to auto-detect:
  - **Priority**: `p1` (Critical), `p2` (Important), `p3` (Low).
  - **Estimated Duration**: Automatically parses `45m`, `90 min`, `2h`.
  - **Cadence / Frequency**: `daily`, `3x/week`, `weekdays`, `weekends`.
  - **Domain Tag**: `focus`, `health`, `career`, `mindset`.
  - **Due Dates & Times**: Relative dates like `tomorrow`, `friday`, `10am`.
- **Goal Linkage**: One-click dropdown to attach quick-added tasks directly to higher-level long-term goals.

### Voice Quick-Add (Web Speech API)

- **Hands-Free Dictation**: One-tap microphone button in the quick-add bar leverages browser Speech Recognition to transcribe spoken words into structured task cards in real-time.
- **Auto-Structuring**: Voice transcripts flow through the natural language parser to extract domain, duration, and priority without typing.

### Visual State & Sensory Completion Feedback

- **Dormant / Active States**: Pending tasks render in a soft, desaturated monochromatic style.
- **Aurora Celebration Burst**: Checking off a task triggers an animated confetti particle burst, sound feedback, and illuminates the domain-specific color gradient.

---

## 2. Flexible Cadence & Procrastination Carry-Forward Engine

### Flexible Schedules & Velocity Forecasting

- **Cadence Rules**: Supports daily requirements, weekly frequencies (e.g., 3 days per week), and custom weekday schedules.
- **Streak Preservation**: Permitted rest days do not break ongoing streaks or trigger carry-forward alerts.
- **Dynamic Velocity**: Completing tasks ahead of schedule recalculates target horizons and advances estimated milestone completion dates.

### Procrastination Carry-Forward & Delay Root-Cause Logging

- **Visual Carry-Forward Badges**: Tasks not completed on their scheduled date carry forward to today with badge counters (`+1`, `+2`, `+3 days overdue`).
- **1-Tap Delay Diagnosis**: Postponing a task prompts a quick root-cause categorization:
  - _Low Energy / Burnout_
  - _Scope Unclear / Too Big_
  - _Blocked by External Factor_
  - _Distracted / Disengaged_
  - _Other_
- **Pattern Learning**: Delay records populate the Procrastination Analytics engine in `/insights`.

---

## 3. Interactive Visual Growth Tree (`/tree`)

### Living Organic Skill Tree

- **Domain Branch System**: Maps personal growth across 4 core life pillars:
  - 🔵 **Focus**: Deep work, study sessions, writing, problem solving.
  - 🟢 **Health**: Fitness, sleep, nutrition, recovery, hydration.
  - 🟣 **Career**: Coding, business projects, certifications, skill building.
  - 🟡 **Mindset**: Meditation, journaling, reading, emotional balance.
- **Organic SVG Growth**: As completions accumulate, the central trunk grows taller and thicker, while branch vectors sprout colorful domain leaves.

### Custom Timeframe & Date Range Filtering

- **Presets**: View your growth tree for **1 Day, 7 Days, 30 Days, 90 Days, 1 Year, 2 Years, or All-Time**.
- **Custom Date Picker**: Select precise **"From"** and **"To"** calendar dates to view growth over specific sprints, quarters, or vacation periods.
- **Export to Image**: One-click export captures a high-resolution PNG snapshot of your Growth Tree ready for saving or sharing.

---

## 4. Multi-Timeframe Insights & Procrastination Analytics (`/insights`)

### Interactive Data Visualizations (Recharts)

- **Metric Selector**: Toggle between **Completions**, **Focus Minutes**, and **Deferrals**.
- **Chart Styles**: Switch between **Smooth Gradient Area Charts**, **Discrete Rounded Bar Charts**, and **Minimal Line Graphs**.
- **Domain Balance Pie Chart**: Visual breakdown of time invested across Focus, Health, Career, and Mindset.
- **Weekday Rhythm Radar Chart**: 7-day polar chart revealing which days of the week have the highest completion volume.
- **Hourly Focus Heatmap**: 24-hour bar chart identifying your peak productivity hours throughout the day.
- **Annual Consistency Heatmap**: Full GitHub-style matrix visualizing daily activity density over the past 365 days.

### Weekly AI Retrospective & Smart Scheduling

- **Automated Performance Synthesis**: Aggregates completions, focus volume, streaks, domain balance, deferrals, and peak hours.
- **Executive Summary**: 2-3 sentence inspiring synthesis of the week's momentum.
- **Top Wins & Highlights**: Bullet highlights celebrating major milestone breakthroughs.
- **Procrastination Analysis**: Behavioral diagnosis of what caused tasks to slip and how to remove friction.
- **Recommended Timetable Adjustments**: Specific scheduling changes for the coming week aligned with peak cognitive hours.
- **Suggested Prime Focus Blocks**: Concrete time slots (e.g., _08:30 - 10:00: High-Bandwidth Deep Work_) tailored to your energy rhythms.

---

## 5. Focus Timer Engine & Web Audio Soundscapes (`/focus`)

### Flexible Timer Modes

- **Pomodoro Mode**: 25 minutes of deep focus followed by a 5-minute restorative break.
- **Deep Work Mode**: 50 minutes of continuous focus with a 10-minute break.
- **Sprint Mode**: 90-minute high-intensity milestone push.
- **Custom Free Timer**: Open-ended stopwatch tracking unstructured focus blocks.

### Built-in Web Audio Ambient Soundscapes

Synthesized natively in the browser via the Web Audio API (zero external streaming latency):

- **10Hz Alpha Waves (Binaural Beats)**: Frequency-offset sine waves promoting deep focus and cognitive flow.
- **Soft Rain**: Low-pass filtered pink noise simulating gentle rainfall.
- **Forest Stream**: Bandpass dynamic noise emulating a natural running brook.
- **Pink Noise**: Balanced soothing frequency spectrum masking background distractions.
- **Live Volume & Track Controls**: Instant mute or track switching while focus timers are running.

---

## 6. Goal Decomposition & Definition of Done (`/goals`)

### Milestone Deconstruction

- **Subtask Hierarchy**: Decompose complex goals (e.g., _"AWS Solutions Architect Certification"_) into 5-8 sequential milestones.
- **Estimated Minutes**: Assign time budgets to each subtask.
- **"Definition of Done"**: Crisp acceptance criteria for each subtask ensuring zero ambiguity when marking items complete.
- **AI Subtask Breakdown Generator**: One-click AI generator creates step-by-step roadmaps with pre-filled definitions of done.

---

## 7. Retrospective Timeline & Shareable Progress Cards (`/achieved`)

### Historical Achievement Log

- **Multi-Period Filtering**: Review everything completed across custom durations (Day, Month, Year, Custom).
- **Domain Categorization**: View completed milestones and tasks grouped by their domain badges.

### Spotify Wrapped-Style Progress Summaries

- **Exportable Progress Cards**: Renders a graphic with total tasks completed, focus hours logged, current streak, and domain distribution.
- **1-Tap Share / Download**: Saves as a high-res PNG image suitable for social sharing, partner updates, or personal archives.

---

## 8. Team & Accountability Circles (`/team`)

### Peer Accountability Circles

- **Squad Challenges**: Collaborative group targets (e.g., _100-Hour Focus Sprint_) with real-time aggregate progress bars.
- **Privacy-Preserving Streaks**: Squad members see active streaks and completion counts without exposing private task notes or sensitive goals.
- **Peer Cheers**: Send one-tap high-five cheers (`🔥`) to celebrate squad members' consistency.
- **Invite Codes**: Join or create custom circles using shareable squad codes.

---

## 9. Smart Reminders & Calendar Synchronization

### Web Push & In-App Reminders

- **Custom Time-of-Day Triggers**: Schedule alerts at specific times (e.g., `09:00 Morning Intentions`, `15:30 Focus Nudge`, `20:30 Evening Review`).
- **Smart Duplicate Prevention**: Ensures reminders fire exactly once per device per scheduled day.

### Calendar Export / Sync (`.ics` Feed)

- **Universal Standard**: Generates standard iCalendar (`.ics`) feeds compatible with **Google Calendar**, **Apple Calendar**, and **Microsoft Outlook**.
- **Detailed Event Metadata**: Exports scheduled tasks, estimated durations, priorities, energy levels, and status directly into your external calendar.

---

## 10. Progressive Web App (PWA) & Offline-First Dual Storage

### Dual-Layer Storage Architecture

- **Instant Offline Access**: Every action is persisted to `localStorage` immediately, allowing full offline usage with zero lag.
- **Seamless Cloud Sync**: When signing in with Supabase Auth, local data is automatically migrated and synced to cloud Postgres tables without losing progress.
- **Optional Guest Mode**: Explore all features immediately without mandatory registration.

---

## 11. Toggleable AI Workspace (Gemini 3.5 Flash)

- **Granular Toggle Controls**: Global toggle in `/settings` plus per-task and per-goal toggles.
- **AI Daily Timetable Generator**: Arranges open tasks into an energy-aligned schedule based on wake/sleep times.
- **AI Goal Breakdown**: Breaks complex objectives into actionable steps with definitions of done.
- **AI Procrastination Diagnostic**: Analyzes deferral patterns to prescribe behavioral adjustments.
- **AI Weekly Retrospective**: Sunday recap summarizing momentum and scheduling recommendations.
