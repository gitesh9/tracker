import type {
  Achievement,
  DeferralLog,
  FocusSession,
  Goal,
  Profile,
  Reminder,
  Subtask,
  Task,
  TeamGoal,
  TeamMember,
  TeamSquad,
  TeamTask,
} from "./types";
import { computeStreak, todayISO } from "./cadence";
import { guessIcon } from "./icons";
import { insertMissing, localDb as db, sql, type LocalTable } from "@/lib/db/pglite";
import { enqueue } from "./offline";

const STORE_KEY_PREFIX = "ascend.local.v2";
const KEYS = {
  profile: `${STORE_KEY_PREFIX}.profile`,
  tasks: `${STORE_KEY_PREFIX}.tasks`,
  goals: `${STORE_KEY_PREFIX}.goals`,
  subtasks: `${STORE_KEY_PREFIX}.subtasks`,
  deferrals: `${STORE_KEY_PREFIX}.deferrals`,
  achievements: `${STORE_KEY_PREFIX}.achievements`,
  sessions: `${STORE_KEY_PREFIX}.sessions`,
  reminders: `${STORE_KEY_PREFIX}.reminders`,
  squads: `${STORE_KEY_PREFIX}.squads`,
  synced_at: `${STORE_KEY_PREFIX}.synced_at`,
};

const memoryCache = new Map<string, unknown>();

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) return [...value] as unknown as T;
  if (typeof value === "object" && value !== null) return { ...value } as unknown as T;
  return value;
}

/** Reads the in-memory working copy. The durable copy lives only in the local
 *  database (see hydrateLocalStore); there is no second copy in browser storage. */
function getStored<T>(key: string, fallback: T): T {
  if (memoryCache.has(key)) return cloneValue(memoryCache.get(key) as T);
  return cloneValue(fallback);
}

function setStored<T>(key: string, data: T): void {
  memoryCache.set(key, cloneValue(data));
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent("ascend:local-change", { detail: { key } }));
}

const GUEST_ID = "guest_user";

/** Replace a local collection with server rows, keeping unsynced guest-authored rows. */
function mirror<T extends { id: string; user_id: string }>(
  key: string,
  rows: T[],
  current: T[],
): T[] {
  const serverIds = new Set(rows.map((r) => r.id));
  const keep = current.filter(
    (r) => !serverIds.has(r.id) && r.user_id === GUEST_ID && UUID_RE.test(r.id),
  );
  const next = [...rows, ...keep];
  setStored(key, next);
  return next;
}

const DEFAULT_PROFILE: Profile = {
  id: "guest_user",
  user_id: "guest_user",
  display_name: null,
  email: null,
  ai_enabled: true,
  current_streak: 0,
  longest_streak: 0,
  last_active_date: todayISO(),
  streak_freezes: 2,
  theme_preference: "dark",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

function sampleTask(partial: Partial<Task> & { id: string; title: string }): Task {
  const now = new Date().toISOString();
  return {
    user_id: "guest_user",
    description: null,
    domain: "focus",
    categories: ["focus"],
    frequency_type: "daily",
    frequency_days: null,
    target_count: 1,
    target_days_per_week: 0,
    weekdays: [],
    estimated_minutes: 25,
    energy_level: "medium",
    priority: "medium",
    due_date: todayISO(),
    scheduled_at: null,
    definition_of_done: null,
    notes: null,
    goal_id: null,
    workspace_id: null,
    icon_name: guessIcon(partial.title),
    is_ai_enabled: false,
    carry_forward_count: 0,
    is_completed: false,
    completed_dates: [],
    linked_task_ids: [],
    created_at: now,
    updated_at: now,
    ...partial,
  };
}

const DEFAULT_TASKS: Task[] = [
  sampleTask({
    id: "sample-1",
    title: "Plan top 3 priorities for today",
    domain: "focus",
    categories: ["focus", "career"],
    estimated_minutes: 15,
    priority: "high",
  }),
  sampleTask({
    id: "sample-2",
    title: "30-min brisk walk or workout",
    domain: "health",
    categories: ["health"],
    estimated_minutes: 30,
    energy_level: "high",
  }),
  sampleTask({
    id: "sample-3",
    title: "Read 10 pages of growth or craft book",
    domain: "mindset",
    categories: ["mindset", "learning"],
    estimated_minutes: 20,
    energy_level: "low",
    priority: "low",
  }),
];

const DEFAULT_SQUADS: TeamSquad[] = [];

export const localDB = {
  getProfile(): Profile {
    return getStored<Profile>(KEYS.profile, DEFAULT_PROFILE);
  },
  saveProfile(patch: Partial<Profile>): Profile {
    const current = localDB.getProfile();
    const updated: Profile = {
      ...current,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    setStored(KEYS.profile, updated);
    void db.from("profiles").upsert(updated as unknown as Record<string, unknown>);
    return updated;
  },
  getTasks(): Task[] {
    const raw = getStored<Task[]>(KEYS.tasks, DEFAULT_TASKS);
    // Deduplicate by ID
    const seen = new Set<string>();
    const deduplicated: Task[] = [];
    for (const t of raw) {
      if (!t || !t.id) continue;
      if (!seen.has(t.id)) {
        seen.add(t.id);
        deduplicated.push(t);
      }
    }
    return deduplicated;
  },
  saveTask(task: Partial<Task> & { title: string }): Task {
    const tasks = localDB.getTasks();
    const id = task.id || crypto.randomUUID();
    const index = tasks.findIndex((t) => t.id === id);
    const now = new Date().toISOString();

    const rawCats = task.categories ?? (task.domain ? [task.domain] : ["focus"]);
    const cleanCats = Array.from(
      new Set(
        rawCats
          .flatMap((c) => (typeof c === "string" ? c.split(/[,;|]/) : []))
          .map((c) => c.trim().toLowerCase())
          .filter(Boolean),
      ),
    );
    const primaryDomain = cleanCats[0] || task.domain || "focus";

    const newTask: Task = {
      id,
      user_id: task.user_id ?? "guest_user",
      title: task.title,
      description: task.description ?? null,
      domain: primaryDomain,
      categories: cleanCats.length > 0 ? cleanCats : [primaryDomain],
      frequency_type: task.frequency_type ?? "daily",
      frequency_days: task.frequency_days ?? null,
      target_count: task.target_count ?? 1,
      target_days_per_week: task.target_days_per_week ?? 0,
      weekdays: task.weekdays ?? [],
      estimated_minutes: task.estimated_minutes ?? 25,
      energy_level: task.energy_level ?? "medium",
      priority: task.priority ?? "medium",
      due_date: task.due_date ?? todayISO(),
      definition_of_done: task.definition_of_done ?? null,
      notes: task.notes ?? null,
      goal_id: task.goal_id ?? null,
      icon_name: task.icon_name ?? guessIcon(task.title ?? ""),
      is_ai_enabled: task.is_ai_enabled ?? false,
      carry_forward_count: task.carry_forward_count ?? 0,
      is_completed: task.is_completed ?? false,
      completed_dates: task.completed_dates ?? [],
      linked_task_ids: (task.linked_task_ids ?? []).filter((l) => l !== id),
      scheduled_at: task.scheduled_at ?? null,
      workspace_id: task.workspace_id ?? null,
      created_at: index >= 0 ? (tasks[index]?.created_at ?? now) : now,
      updated_at: now,
    };
    let updatedTasks: Task[];
    if (index >= 0) {
      updatedTasks = tasks.map((t, i) => (i === index ? { ...t, ...newTask } : t));
    } else {
      updatedTasks = [newTask, ...tasks.filter((t) => t.id !== id)];
    }
    setStored(KEYS.tasks, updatedTasks);
    return newTask;
  },
  updateTask(id: string, patch: Partial<Task>): Task | null {
    const tasks = localDB.getTasks();
    const index = tasks.findIndex((t) => t.id === id);
    if (index === -1) return null;

    const existing = tasks[index]!;
    let patchCategories = patch.categories;
    let patchDomain = patch.domain;

    if (patchCategories !== undefined) {
      const clean = Array.from(
        new Set(
          patchCategories
            .flatMap((c) => (typeof c === "string" ? c.split(/[,;|]/) : []))
            .map((c) => c.trim().toLowerCase())
            .filter(Boolean),
        ),
      );
      patchCategories = clean.length > 0 ? clean : ["focus"];
      if (patchDomain === undefined) {
        patchDomain = patchCategories[0] || "focus";
      }
    } else if (patchDomain !== undefined) {
      const clean = Array.from(
        new Set(
          patchDomain
            .split(/[,;|]/)
            .map((c) => c.trim().toLowerCase())
            .filter(Boolean),
        ),
      );
      patchCategories = clean.length > 0 ? clean : [patchDomain];
      patchDomain = clean[0] || patchDomain;
    }

    const updated: Task = {
      ...existing,
      ...patch,
      ...(patchCategories !== undefined ? { categories: patchCategories } : {}),
      ...(patchDomain !== undefined ? { domain: patchDomain } : {}),
      updated_at: new Date().toISOString(),
    };
    const updatedTasks = tasks.map((t, i) => (i === index ? updated : t));
    setStored(KEYS.tasks, updatedTasks);
    return updated;
  },
  deleteTask(id: string): void {
    const tasks = localDB
      .getTasks()
      .filter((t) => t.id !== id)
      .map((t) =>
        t.linked_task_ids?.includes(id)
          ? { ...t, linked_task_ids: t.linked_task_ids.filter((l) => l !== id) }
          : t,
      );
    setStored(KEYS.tasks, tasks);
    const subtasks = localDB.getSubtasks().filter((s) => s.task_id !== id);
    setStored(KEYS.subtasks, subtasks);
  },
  getGoals(): Goal[] {
    const raw = getStored<Goal[]>(KEYS.goals, []);
    const seen = new Set<string>();
    const deduplicated: Goal[] = [];
    for (const g of raw) {
      if (!g || !g.id) continue;
      if (!seen.has(g.id)) {
        seen.add(g.id);
        deduplicated.push(g);
      }
    }
    return deduplicated;
  },
  saveGoal(goal: Partial<Goal> & { title: string }): Goal {
    const goals = localDB.getGoals();
    const id = goal.id || crypto.randomUUID();
    const index = goals.findIndex((g) => g.id === id);
    const now = new Date().toISOString();
    const newGoal: Goal = {
      id,
      user_id: goal.user_id ?? "guest_user",
      title: goal.title,
      description: goal.description ?? null,
      domain: goal.domain ?? "career",
      target_date: goal.target_date ?? null,
      status: goal.status ?? "in_progress",
      ai_split_accepted: goal.ai_split_accepted ?? false,
      icon_name: goal.icon_name ?? "target",
      is_completed: goal.is_completed ?? false,
      projected_completion_date: goal.projected_completion_date ?? null,
      target_days: goal.target_days ?? 30,
      workspace_id: goal.workspace_id ?? null,
      created_at: index >= 0 ? (goals[index]?.created_at ?? now) : now,
      updated_at: now,
    };
    let updatedGoals: Goal[];
    if (index >= 0) {
      updatedGoals = goals.map((g, i) => (i === index ? { ...g, ...newGoal } : g));
    } else {
      updatedGoals = [newGoal, ...goals.filter((g) => g.id !== id)];
    }
    setStored(KEYS.goals, updatedGoals);
    return newGoal;
  },
  updateGoal(id: string, patch: Partial<Goal>): Goal | null {
    const goals = localDB.getGoals();
    const index = goals.findIndex((g) => g.id === id);
    if (index === -1) return null;
    const updated: Goal = {
      ...goals[index]!,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    const updatedGoals = goals.map((g, i) => (i === index ? updated : g));
    setStored(KEYS.goals, updatedGoals);
    return updated;
  },
  deleteGoal(id: string): void {
    const goals = localDB.getGoals().filter((g) => g.id !== id);
    setStored(KEYS.goals, goals);
    const subtasks = localDB.getSubtasks().filter((s) => s.goal_id !== id);
    setStored(KEYS.subtasks, subtasks);
  },
  getSubtasks(): Subtask[] {
    const raw = getStored<Subtask[]>(KEYS.subtasks, []);
    const seen = new Set<string>();
    const deduplicated: Subtask[] = [];
    for (const s of raw) {
      if (!s || !s.id) continue;
      if (!seen.has(s.id)) {
        seen.add(s.id);
        deduplicated.push(s);
      }
    }
    return deduplicated;
  },
  saveSubtasks(rows: (Partial<Subtask> & { title: string })[]): Subtask[] {
    const current = localDB.getSubtasks();
    const incomingIds = new Set(rows.map((r) => r.id).filter(Boolean));
    const filteredCurrent = current.filter((s) => !incomingIds.has(s.id));
    const created: Subtask[] = rows.map((r, i) => {
      const existing = current.find((s) => s.id === r.id);
      return {
        id: r.id || crypto.randomUUID(),
        goal_id: r.goal_id ?? existing?.goal_id ?? null,
        task_id: r.task_id ?? existing?.task_id ?? null,
        user_id: r.user_id ?? existing?.user_id ?? GUEST_ID,
        title: r.title,
        estimated_minutes: r.estimated_minutes ?? existing?.estimated_minutes ?? 30,
        target_date: r.target_date ?? existing?.target_date ?? null,
        is_completed: r.is_completed ?? existing?.is_completed ?? false,
        position: r.position ?? existing?.position ?? filteredCurrent.length + i,
        completed_at: r.completed_at ?? existing?.completed_at ?? null,
        definition_of_done: r.definition_of_done ?? existing?.definition_of_done ?? null,
        parent_id: r.parent_id ?? existing?.parent_id ?? null,
        created_at: existing?.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });
    const next = [...filteredCurrent, ...created];
    setStored(KEYS.subtasks, next);
    return created;
  },
  /** Mirrors of server reads. Server rows win; rows authored while signed out that the
   *  server has not seen yet are kept so the login sync can still push them. */
  replaceTasks(rows: Task[]): Task[] {
    return mirror(KEYS.tasks, rows, localDB.getTasks());
  },
  replaceGoals(rows: Goal[]): Goal[] {
    return mirror(KEYS.goals, rows, localDB.getGoals());
  },
  replaceSubtasks(rows: Subtask[]): Subtask[] {
    return mirror(KEYS.subtasks, rows, localDB.getSubtasks());
  },
  replaceDeferrals(rows: DeferralLog[]): DeferralLog[] {
    return mirror(KEYS.deferrals, rows, localDB.getDeferrals());
  },
  replaceAchievements(rows: Achievement[]): Achievement[] {
    return mirror(KEYS.achievements, rows, localDB.getAchievements());
  },
  replaceFocusSessions(rows: FocusSession[]): FocusSession[] {
    return mirror(KEYS.sessions, rows, localDB.getFocusSessions());
  },
  replaceReminders(rows: Reminder[]): Reminder[] {
    return mirror(KEYS.reminders, rows, localDB.getReminders());
  },
  updateSubtask(id: string, patch: Partial<Subtask>): Subtask | null {
    const subtasks = localDB.getSubtasks();
    const index = subtasks.findIndex((s) => s.id === id);
    if (index === -1) return null;
    const updated: Subtask = {
      ...subtasks[index]!,
      ...patch,
    };
    subtasks[index] = updated;
    setStored(KEYS.subtasks, subtasks);
    return updated;
  },
  deleteSubtask(id: string): void {
    const subtasks = localDB.getSubtasks().filter((s) => s.id !== id);
    setStored(KEYS.subtasks, subtasks);
  },
  getDeferrals(): DeferralLog[] {
    return getStored<DeferralLog[]>(KEYS.deferrals, []);
  },
  saveDeferral(log: { task_id: string; reason_category: string; notes?: string }): DeferralLog {
    const deferrals = localDB.getDeferrals();
    const newLog: DeferralLog = {
      id: crypto.randomUUID(),
      user_id: "guest_user",
      task_id: log.task_id,
      reason_category: log.reason_category,
      notes: log.notes ?? null,
      logged_at: new Date().toISOString(),
    };
    deferrals.unshift(newLog);
    setStored(KEYS.deferrals, deferrals);
    return newLog;
  },
  getAchievements(): Achievement[] {
    return getStored<Achievement[]>(KEYS.achievements, []);
  },
  unlockAchievement(badge_key: string): Achievement {
    const achievements = localDB.getAchievements();
    const existing = achievements.find((a) => a.badge_key === badge_key);
    if (existing) return existing;
    const newAch: Achievement = {
      id: crypto.randomUUID(),
      user_id: "guest_user",
      badge_key,
      unlocked_at: new Date().toISOString(),
    };
    achievements.unshift(newAch);
    setStored(KEYS.achievements, achievements);
    return newAch;
  },
  getFocusSessions(): FocusSession[] {
    return getStored<FocusSession[]>(KEYS.sessions, []);
  },
  saveFocusSession(input: {
    task_id?: string | null;
    mode: string;
    minutes: number;
    started_at: string;
  }): FocusSession {
    const sessions = localDB.getFocusSessions();
    const newSession: FocusSession = {
      id: crypto.randomUUID(),
      user_id: "guest_user",
      task_id: input.task_id ?? null,
      mode: input.mode,
      minutes: input.minutes,
      started_at: input.started_at,
      ended_at: new Date().toISOString(),
    };
    sessions.unshift(newSession);
    setStored(KEYS.sessions, sessions);
    return newSession;
  },
  getReminders(): Reminder[] {
    return getStored<Reminder[]>(KEYS.reminders, []);
  },
  saveReminder(input: Partial<Reminder> & { label: string; remind_at: string }): Reminder {
    const reminders = localDB.getReminders();
    const id = input.id || crypto.randomUUID();
    const index = reminders.findIndex((r) => r.id === id);
    const newReminder: Reminder = {
      id,
      user_id: input.user_id ?? "guest_user",
      task_id: input.task_id ?? null,
      label: input.label,
      remind_at: input.remind_at,
      is_sent: input.is_sent ?? false,
      is_enabled: input.is_enabled ?? true,
      created_at: new Date().toISOString(),
    };
    if (index >= 0) {
      reminders[index] = { ...reminders[index]!, ...newReminder };
    } else {
      reminders.push(newReminder);
    }
    setStored(KEYS.reminders, reminders);
    return newReminder;
  },
  deleteReminder(id: string): void {
    const reminders = localDB.getReminders().filter((r) => r.id !== id);
    setStored(KEYS.reminders, reminders);
  },
  syncStreak(tasks: Task[]): Profile {
    const streak = computeStreak(tasks);
    const profile = localDB.getProfile();
    const longest = Math.max(streak, profile.longest_streak ?? 0);
    return localDB.saveProfile({
      current_streak: streak,
      longest_streak: longest,
      last_active_date: todayISO(),
    });
  },
  getSquads(): TeamSquad[] {
    return getStored<TeamSquad[]>(KEYS.squads, DEFAULT_SQUADS);
  },
  /** Keeps a squad on this device. Sharing with teammates goes through squads-remote. */
  saveSquad(squad: TeamSquad): TeamSquad {
    return localDB.saveSquadLocal(squad);
  },
  saveSquadLocal(squad: TeamSquad): TeamSquad {
    const squads = localDB.getSquads();
    const index = squads.findIndex((s) => s.id === squad.id);
    if (index >= 0) squads[index] = squad;
    else squads.unshift(squad);
    setStored(KEYS.squads, squads);
    void db.from("squads").upsert({ ...squad, updated_at: new Date().toISOString() } as unknown as Record<string, unknown>);
    return squad;
  },
  /** Replaces every squad on this device with the server's latest list. */
  replaceSquads(next: TeamSquad[]): void {
    const removed = localDB.getSquads().filter((s) => !next.some((n) => n.id === s.id));
    setStored(KEYS.squads, next);
    for (const s of removed) void db.from("squads").delete().eq("id", s.id);
    for (const s of next)
      void db.from("squads").upsert({ ...s, updated_at: new Date().toISOString() } as unknown as Record<string, unknown>);
  },
  createSquad(name: string, description: string): TeamSquad {
    const code = `SQUAD-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const userProfile = localDB.getProfile();
    const displayName = userProfile.display_name || userProfile.email?.split("@")[0] || "You";
    const today = todayISO();
    const completedToday = localDB
      .getTasks()
      .filter((t) => t.is_completed || t.completed_dates?.includes(today)).length;

    const newSquad: TeamSquad = {
      id: `squad-${crypto.randomUUID()}`,
      name,
      description,
      code,
      createdAt: new Date().toISOString(),
      members: [
        {
          id: userProfile.id || "member-me",
          name: `${displayName} (Leader)`,
          role: "leader",
          currentStreak: userProfile.current_streak || 0,
          todayCompletions: completedToday,
          lastActive: "Just now",
          cheersReceived: 0,
        },
      ],
      goals: [],
      tasks: [],
    };
    return localDB.saveSquad(newSquad);
  },
  joinSquad(code: string): TeamSquad | null {
    const squads = localDB.getSquads();
    const trimmed = code.trim().toUpperCase();
    const found = squads.find((s) => s.code.toUpperCase() === trimmed);
    if (!found) return null;

    const userProfile = localDB.getProfile();
    const userId = userProfile.id || "member-me";
    const alreadyMember = found.members.some((m) => m.id === userId);
    if (!alreadyMember) {
      const displayName = userProfile.display_name || userProfile.email?.split("@")[0] || "You";
      const today = todayISO();
      const completedToday = localDB
        .getTasks()
        .filter((t) => t.is_completed || t.completed_dates?.includes(today)).length;

      found.members.push({
        id: userId,
        name: displayName,
        role: "member",
        currentStreak: userProfile.current_streak || 0,
        todayCompletions: completedToday,
        lastActive: "Just now",
        cheersReceived: 0,
      });
      localDB.saveSquad(found);
    }
    return found;
  },
  addTeamGoal(
    squadId: string,
    goal: Omit<TeamGoal, "id" | "squadId" | "createdAt" | "isCompleted" | "contributors">,
  ): TeamGoal {
    const squads = localDB.getSquads();
    const squad = squads.find((s) => s.id === squadId) || squads[0]!;
    const userProfile = localDB.getProfile();
    const displayName = userProfile.display_name || userProfile.email?.split("@")[0] || "You";

    const newGoal: TeamGoal = {
      id: `tgoal-${crypto.randomUUID()}`,
      squadId: squad.id,
      title: goal.title,
      domain: goal.domain,
      targetCount: goal.targetCount,
      currentCount: 0,
      unit: goal.unit || "tasks",
      ...(goal.deadline ? { deadline: goal.deadline } : {}),
      isCompleted: false,
      contributors: [
        {
          memberId: userProfile.id || "member-me",
          name: displayName,
          count: 0,
        },
      ],
      createdAt: new Date().toISOString(),
    };
    squad.goals.push(newGoal);
    localDB.saveSquad(squad);
    return newGoal;
  },
  addTeamTask(
    squadId: string,
    task: Omit<TeamTask, "id" | "squadId" | "createdAt" | "isCompleted">,
  ): TeamTask {
    const squads = localDB.getSquads();
    const squad = squads.find((s) => s.id === squadId) || squads[0]!;
    const newTask: TeamTask = {
      id: `ttask-${crypto.randomUUID()}`,
      squadId: squad.id,
      title: task.title,
      domain: task.domain,
      assignedTo: task.assignedTo || "everyone",
      assignedName: task.assignedName || "Everyone",
      estimatedMinutes: task.estimatedMinutes || 30,
      priority: task.priority || "p2",
      ...(task.dueDate ? { dueDate: task.dueDate } : {}),
      isCompleted: false,
      createdAt: new Date().toISOString(),
    };
    squad.tasks.unshift(newTask);
    localDB.saveSquad(squad);
    return newTask;
  },
  toggleTeamTask(squadId: string, taskId: string): TeamTask | null {
    const squads = localDB.getSquads();
    const squad = squads.find((s) => s.id === squadId);
    if (!squad) return null;
    const task = squad.tasks.find((t) => t.id === taskId);
    if (!task) return null;

    const userProfile = localDB.getProfile();
    const displayName = userProfile.display_name || userProfile.email?.split("@")[0] || "You";
    const userId = userProfile.id || "member-me";

    task.isCompleted = !task.isCompleted;
    if (task.isCompleted) {
      task.completedBy = displayName;
      task.completedAt = new Date().toISOString();
      // increment member completions
      const me = squad.members.find((m) => m.id === userId || m.id === "member-me");
      if (me) me.todayCompletions += 1;

      // Also update squad goals with matching domain or unit
      squad.goals.forEach((g) => {
        if (!g.isCompleted) {
          g.currentCount = Math.min(g.targetCount, (g.currentCount || 0) + 1);
          if (g.currentCount >= g.targetCount) g.isCompleted = true;
          const contributor = g.contributors.find(
            (c) => c.memberId === userId || c.memberId === "member-me",
          );
          if (contributor) {
            contributor.count += 1;
          } else {
            g.contributors.push({ memberId: userId, name: displayName, count: 1 });
          }
        }
      });
    } else {
      delete task.completedBy;
      delete task.completedAt;
      const me = squad.members.find((m) => m.id === userId || m.id === "member-me");
      if (me && me.todayCompletions > 0) me.todayCompletions -= 1;
    }
    localDB.saveSquad(squad);
    return task;
  },
  cheerTeammate(squadId: string, memberId: string): number {
    const squads = localDB.getSquads();
    const squad = squads.find((s) => s.id === squadId);
    if (!squad) return 0;
    const member = squad.members.find((m) => m.id === memberId);
    if (!member) return 0;
    member.cheersReceived = (member.cheersReceived || 0) + 1;
    localDB.saveSquad(squad);
    return member.cheersReceived;
  },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TABLE_KEYS: [LocalTable, string][] = [
  ["tasks", KEYS.tasks],
  ["goals", KEYS.goals],
  ["subtasks", KEYS.subtasks],
  ["focus_sessions", KEYS.sessions],
  ["deferral_logs", KEYS.deferrals],
  ["achievements", KEYS.achievements],
  ["reminders", KEYS.reminders],
  ["squads", KEYS.squads],
];

/** One-time migration: earlier versions kept a second copy of everything in browser
 *  storage. Copy anything the local database is missing, then delete that copy. */
export async function mirrorLocalDataToDb(): Promise<number> {
  if (!isBrowser()) return 0;
  let count = 0;
  try {
    for (const [table, key] of [...TABLE_KEYS, ["profiles", KEYS.profile] as [LocalTable, string]]) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as unknown;
      const rows = (Array.isArray(parsed) ? parsed : [parsed]) as Record<string, unknown>[];
      count += await insertMissing(table, rows);
      window.localStorage.removeItem(key);
    }
    window.localStorage.removeItem(KEYS.synced_at);
  } catch (err) {
    console.warn("[Ascend] legacy storage migration partial failure:", err);
  }
  return count;
}

let hydrating: Promise<void> | null = null;

/** Loads the local database into the in-memory working copy before the app renders.
 *  Keys written in memory before hydration finished are newer and are kept. */
export function hydrateLocalStore(): Promise<void> {
  if (!isBrowser()) return Promise.resolve();
  if (!hydrating) {
    hydrating = (async () => {
      await mirrorLocalDataToDb();
      for (const [table, key] of TABLE_KEYS) {
        if (memoryCache.has(key)) continue;
        const rows = await sql<{ id: string; data: Record<string, unknown> }>(
          `select id, data from ${table} where deleted = false order by updated_at desc`,
        );
        if (rows.length > 0) memoryCache.set(key, rows.map((r) => ({ ...r.data, id: r.id })));
      }
      if (!memoryCache.has(KEYS.profile)) {
        const rows = await sql<{ id: string; data: Record<string, unknown> }>(
          `select id, data from profiles where deleted = false order by updated_at desc limit 1`,
        );
        if (rows[0]) memoryCache.set(KEYS.profile, { ...DEFAULT_PROFILE, ...rows[0].data });
      }
    })().catch((err) => {
      console.warn("[Ascend] could not load the local database:", err);
    });
  }
  return hydrating;
}

/** Re-reads squads after a sync pulled changes from another device. */
export async function reloadSquadsFromDb(): Promise<void> {
  const rows = await sql<{ id: string; data: Record<string, unknown> }>(
    `select id, data from squads where deleted = false order by updated_at desc`,
  );
  memoryCache.set(
    KEYS.squads,
    rows.map((r) => ({ ...r.data, id: r.id })),
  );
}

/** Refreshes the in-memory working copy for tables that a sync just changed, so edits
 *  from other devices appear right away instead of after a restart. */
export async function reloadTablesFromDb(tables: string[]): Promise<void> {
  if (!isBrowser()) return;
  for (const [table, key] of TABLE_KEYS) {
    if (!tables.includes(table)) continue;
    const rows = await sql<{ id: string; data: Record<string, unknown> }>(
      `select id, data from ${table} where deleted = false order by updated_at desc`,
    );
    memoryCache.set(key, rows.map((r) => ({ ...r.data, id: r.id })));
  }
  if (tables.includes("profiles")) {
    const rows = await sql<{ id: string; data: Record<string, unknown> }>(
      `select id, data from profiles where deleted = false order by updated_at desc limit 1`,
    );
    if (rows[0]) memoryCache.set(KEYS.profile, { ...DEFAULT_PROFILE, ...rows[0].data });
  }
}
