import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { localDb as db } from "@/lib/db/pglite";
import { getLocalUser } from "./identity";
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
  TeamSquad,
  TeamTask,
} from "./types";
import { todayISO } from "./cadence";
import { enqueue, hasPending, isOffline, type NewOp, type QueueTable } from "./offline";
import * as squadsRemote from "./squads-remote";
import { localDB } from "./local-store";
import { persistTaskWrite } from "./task-writes";

export const qk = {
  profile: ["profile"] as const,
  tasks: ["tasks"] as const,
  goals: ["goals"] as const,
  subtasks: ["subtasks"] as const,
  deferrals: ["deferrals"] as const,
  achievements: ["achievements"] as const,
  sessions: ["focus_sessions"] as const,
  reminders: ["reminders"] as const,
  squads: ["squads"] as const,
};

/** There is no remote sign-in any more: the local device owner is always "the user".
 *  Kept as an async function so every existing call site stays unchanged. */
export async function getAuthSessionUser(): Promise<{ id: string; email?: string } | null> {
  if (typeof window === "undefined") return null;
  return getLocalUser();
}

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

function dedupe<T>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const id = (item as { id?: string } | null)?.id;
    if (item && id && !seen.has(id)) {
      seen.add(id);
      out.push(item);
    }
  }
  return out;
}

/** Reads come from the local Postgres database. It is always available, so the only
 *  reason to fall back to the in-memory/localStorage mirror is a storage failure,
 *  which each reader already handles. */
function useLocalFor(_table: QueueTable): boolean {
  return false;
}

type RemoteResult<T> = { data: T | null; error: { message: string } | null };

/** Writes always land in the local database first and are queued in the outbox so the
 *  optional remote database catches up whenever a connection is available. */
async function runRemote<T>(
  outboxOp: NewOp,
  op: () => PromiseLike<RemoteResult<T>>,
): Promise<T | null> {
  let result: T | null = null;
  try {
    const { data, error } = await op();
    if (!error) result = data;
  } catch {
    result = null;
  }
  enqueue(outboxOp);
  return result;
}

export function useAuthUser() {
  return useQuery({
    queryKey: ["auth_user"] as const,
    queryFn: async () => {
      return getAuthSessionUser();
    },
    staleTime: 5_000,
  });
}

export function useProfile() {
  return useQuery({
    queryKey: qk.profile,
    queryFn: async (): Promise<Profile | null> => {
      const user = await getAuthSessionUser();
      if (!user || useLocalFor("profiles")) {
        return localDB.getProfile();
      }
      try {
        const { data, error } = await db.from("profiles").select("*").maybeSingle();
        if (error || !data) {
          return localDB.getProfile();
        }
        return localDB.saveProfile(data);
      } catch {
        return localDB.getProfile();
      }
    },
  });
}

export function useTasks() {
  return useQuery({
    queryKey: qk.tasks,
    // Hydrated before the app opens and refreshed after remote pulls. Reading SQL
    // here used to replace newer optimistic edits with an older in-flight snapshot.
    queryFn: (): Task[] => localDB.getTasks(),
  });
}

export function useGoals() {
  return useQuery({
    queryKey: qk.goals,
    queryFn: async (): Promise<Goal[]> => {
      const user = await getAuthSessionUser();
      if (!user || useLocalFor("goals")) {
        return localDB.getGoals();
      }
      try {
        const res = await db.from("goals").select("*").order("created_at", { ascending: false });
        if (res.error) return localDB.getGoals();
        const items = dedupe(unwrap(res) as Goal[]);
        if (items.length > 0) return localDB.replaceGoals(items);
        return localDB.getGoals();
      } catch {
        return localDB.getGoals();
      }
    },
  });
}

export function useSubtasks() {
  return useQuery({
    queryKey: qk.subtasks,
    queryFn: async (): Promise<Subtask[]> => {
      const user = await getAuthSessionUser();
      if (!user || useLocalFor("subtasks")) {
        return localDB.getSubtasks();
      }
      try {
        const res = await db.from("subtasks").select("*").order("position", { ascending: true });
        if (res.error) return localDB.getSubtasks();
        const items = dedupe(unwrap(res) as Subtask[]);
        if (items.length > 0) return localDB.replaceSubtasks(items);
        return localDB.getSubtasks();
      } catch {
        return localDB.getSubtasks();
      }
    },
  });
}

export function useDeferrals() {
  return useQuery({
    queryKey: qk.deferrals,
    queryFn: async (): Promise<DeferralLog[]> => {
      const user = await getAuthSessionUser();
      if (!user || useLocalFor("deferral_logs")) {
        return localDB.getDeferrals();
      }
      try {
        const res = await db
          .from("deferral_logs")
          .select("*")
          .order("logged_at", { ascending: false });
        if (res.error) return localDB.getDeferrals();
        const items = unwrap(res);
        if (items.length > 0) return localDB.replaceDeferrals(items);
        return localDB.getDeferrals();
      } catch {
        return localDB.getDeferrals();
      }
    },
  });
}

export function useAchievements() {
  return useQuery({
    queryKey: qk.achievements,
    queryFn: async (): Promise<Achievement[]> => {
      const user = await getAuthSessionUser();
      if (!user || useLocalFor("achievements")) {
        return localDB.getAchievements();
      }
      try {
        const res = await db
          .from("achievements")
          .select("*")
          .order("unlocked_at", { ascending: false });
        if (res.error) return localDB.getAchievements();
        const items = unwrap(res);
        if (items.length > 0) return localDB.replaceAchievements(items);
        return localDB.getAchievements();
      } catch {
        return localDB.getAchievements();
      }
    },
  });
}

export function useFocusSessions() {
  return useQuery({
    queryKey: qk.sessions,
    queryFn: async (): Promise<FocusSession[]> => {
      const user = await getAuthSessionUser();
      if (!user || useLocalFor("focus_sessions")) {
        return localDB.getFocusSessions();
      }
      try {
        const res = await db
          .from("focus_sessions")
          .select("*")
          .order("started_at", { ascending: false });
        if (res.error) return localDB.getFocusSessions();
        const items = unwrap(res);
        if (items.length > 0) return localDB.replaceFocusSessions(items);
        return localDB.getFocusSessions();
      } catch {
        return localDB.getFocusSessions();
      }
    },
  });
}

export function useReminders() {
  return useQuery({
    queryKey: qk.reminders,
    queryFn: async (): Promise<Reminder[]> => {
      const user = await getAuthSessionUser();
      if (!user || useLocalFor("reminders")) {
        return localDB.getReminders();
      }
      try {
        const res = await db.from("reminders").select("*").order("remind_at", { ascending: true });
        if (res.error) return localDB.getReminders();
        const items = unwrap(res);
        if (items.length > 0) return localDB.replaceReminders(items);
        return localDB.getReminders();
      } catch {
        return localDB.getReminders();
      }
    },
  });
}

function cleanCategories(input: Partial<Task>): { categories: string[]; domain: string } {
  const rawCats = input.categories ?? (input.domain ? [input.domain] : ["focus"]);
  const cleanCats = Array.from(
    new Set(
      rawCats
        .flatMap((c) => (typeof c === "string" ? c.split(/[,;|]/) : []))
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
  const domain = cleanCats[0] || input.domain || "focus";
  return { categories: cleanCats.length > 0 ? cleanCats : [domain], domain };
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Task> & { title: string }) => {
      const taskId = input.id || crypto.randomUUID();
      const taskWithId = { ...input, id: taskId };
      const user = await getAuthSessionUser();
      if (!user) {
        return localDB.saveTask(taskWithId);
      }
      const localRow = localDB.saveTask({ ...taskWithId, user_id: user.id });
      const { id: _localId, ...rowWithoutId } = localRow;
      const row = { ...rowWithoutId, id: taskId, user_id: user.id };
      const data = await runRemote({ kind: "upsert", table: "tasks", rowId: taskId, row }, () =>
        db.from("tasks").upsert(row, { onConflict: "id" }).select().single(),
      );
      return localDB.saveTask(data ?? localRow);
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: qk.tasks });
      const prev = qc.getQueryData<Task[]>(qk.tasks) ?? [];
      if (!input.id) {
        input.id = crypto.randomUUID();
      }
      const taskId = input.id;
      const now = new Date().toISOString();
      const { categories, domain } = cleanCategories(input);
      const optimisticTask: Task = {
        id: taskId,
        user_id: input.user_id ?? "guest_user",
        title: input.title,
        description: input.description ?? null,
        domain,
        categories,
        frequency_type: input.frequency_type ?? "daily",
        frequency_days: input.frequency_days ?? null,
        target_count: input.target_count ?? 1,
        target_days_per_week: input.target_days_per_week ?? 0,
        weekdays: input.weekdays ?? [],
        estimated_minutes: input.estimated_minutes ?? 25,
        energy_level: input.energy_level ?? "medium",
        priority: input.priority ?? "medium",
        due_date: input.due_date ?? todayISO(),
        definition_of_done: input.definition_of_done ?? null,
        notes: input.notes ?? null,
        goal_id: input.goal_id ?? null,
        icon_name: input.icon_name ?? "sparkles",
        is_ai_enabled: input.is_ai_enabled ?? false,
        carry_forward_count: input.carry_forward_count ?? 0,
        is_completed: input.is_completed ?? false,
        completed_dates: input.completed_dates ?? [],
        linked_task_ids: input.linked_task_ids ?? [],
        scheduled_at: input.scheduled_at ?? null,
        workspace_id: input.workspace_id ?? null,
        created_at: now,
        updated_at: now,
      };

      // Save to localDB immediately for local offline persistence
      localDB.saveTask(optimisticTask);

      // Instantly inject into React Query active cache so UI updates in 0ms
      qc.setQueryData<Task[]>(qk.tasks, [optimisticTask, ...prev.filter((t) => t.id !== taskId)]);

      return { prev, taskId };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.tasks, ctx.prev);
    },
    onSuccess: (savedTask, _vars, ctx) => {
      if (savedTask) {
        localDB.saveTask(savedTask);
        qc.setQueryData<Task[]>(qk.tasks, (old) => {
          const filtered = (old ?? []).filter((t) => t.id !== ctx?.taskId && t.id !== savedTask.id);
          return [savedTask, ...filtered];
        });
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.tasks });
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Task> }) => persistTaskWrite(id, async () => {
      // Persist patches in click order; never apply an older saved row to the UI.
      const result = await db.from("tasks").update(patch).eq("id", id);
      if (result.error) throw new Error(result.error.message);
      enqueue({ kind: "update", table: "tasks", rowId: id, patch: patch as Record<string, unknown> });
      return localDB.getTasks().find((task) => task.id === id) ?? null;
    }),
    onMutate: ({ id, patch }) => {
      void qc.cancelQueries({ queryKey: qk.tasks });
      localDB.updateTask(id, patch);
      qc.setQueryData<Task[]>(qk.tasks, localDB.getTasks());
    },
    // No whole-list rollback or refetch: either could erase a newer click on this
    // task (or an unrelated one). The local working copy stays current.
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      localDB.deleteTask(id);
      const user = await getAuthSessionUser();
      if (!user) return id;
      await runRemote({ kind: "delete", table: "tasks", rowId: id }, () =>
        db.from("tasks").delete().eq("id", id),
      );
      return id;
    },
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: qk.tasks });
      await qc.cancelQueries({ queryKey: qk.subtasks });
      const prev = qc.getQueryData<Task[]>(qk.tasks);
      const prevSubtasks = qc.getQueryData<Subtask[]>(qk.subtasks);
      localDB.deleteTask(id);
      qc.setQueryData<Task[]>(qk.tasks, (old) =>
        (old ?? [])
          .filter((t) => t.id !== id)
          .map((t) =>
            t.linked_task_ids?.includes(id)
              ? { ...t, linked_task_ids: t.linked_task_ids.filter((l) => l !== id) }
              : t,
          ),
      );
      qc.setQueryData<Subtask[]>(qk.subtasks, (old) => (old ?? []).filter((s) => s.task_id !== id));
      return { prev, prevSubtasks };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.tasks, ctx.prev);
      if (ctx?.prevSubtasks) qc.setQueryData(qk.subtasks, ctx.prevSubtasks);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.tasks });
      qc.invalidateQueries({ queryKey: qk.subtasks });
    },
  });
}

export function useLogDeferral() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      task_id,
      reason_category,
      notes,
    }: {
      task_id: string;
      reason_category: string;
      notes?: string;
    }) => {
      const local = localDB.saveDeferral({ task_id, reason_category, ...(notes ? { notes } : {}) });
      const user = await getAuthSessionUser();
      if (!user) return;
      const row = {
        id: local.id,
        task_id,
        user_id: user.id,
        reason_category,
        notes: notes ?? null,
        logged_at: local.logged_at,
      };
      await runRemote({ kind: "upsert", table: "deferral_logs", rowId: local.id, row }, () =>
        db.from("deferral_logs").upsert(row, { onConflict: "id" }),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.deferrals }),
  });
}

export function useSaveGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Goal> & { title: string }) => {
      const goalId = input.id || crypto.randomUUID();
      const goalWithId = { ...input, id: goalId };
      const user = await getAuthSessionUser();
      if (!user) return localDB.saveGoal(goalWithId);

      // onMutate has already inserted into the working copy. That does not prove
      // a durable row exists: use upsert for both first save and later saves.
      const localRow = localDB.saveGoal({ ...goalWithId, user_id: user.id });
      const row = { ...localRow, id: goalId, user_id: user.id };
      const data = await runRemote({ kind: "upsert", table: "goals", rowId: goalId, row }, () =>
        db.from("goals").upsert(row, { onConflict: "id" }).select().single(),
      );
      return localDB.saveGoal(data ?? localRow);
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: qk.goals });
      const prev = qc.getQueryData<Goal[]>(qk.goals) ?? [];
      if (!input.id) {
        input.id = crypto.randomUUID();
      }
      const goalId = input.id;
      const now = new Date().toISOString();
      const existing = prev.find((g) => g.id === goalId);
      const optimisticGoal: Goal = {
        id: goalId,
        user_id: input.user_id ?? existing?.user_id ?? "guest_user",
        title: input.title,
        description: input.description ?? existing?.description ?? null,
        domain: input.domain ?? existing?.domain ?? "career",
        target_date: input.target_date ?? existing?.target_date ?? null,
        status: input.status ?? existing?.status ?? "in_progress",
        ai_split_accepted: input.ai_split_accepted ?? existing?.ai_split_accepted ?? false,
        icon_name: input.icon_name ?? existing?.icon_name ?? "target",
        is_completed: input.is_completed ?? existing?.is_completed ?? false,
        projected_completion_date:
          input.projected_completion_date ?? existing?.projected_completion_date ?? null,
        target_days: input.target_days ?? existing?.target_days ?? 30,
        workspace_id: input.workspace_id ?? existing?.workspace_id ?? null,
        created_at: existing?.created_at ?? now,
        updated_at: now,
      };
      localDB.saveGoal(optimisticGoal);
      qc.setQueryData<Goal[]>(qk.goals, [optimisticGoal, ...prev.filter((g) => g.id !== goalId)]);
      return { prev, goalId };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.goals, ctx.prev);
    },
    onSuccess: (savedGoal, _vars, ctx) => {
      if (savedGoal) {
        localDB.saveGoal(savedGoal);
        qc.setQueryData<Goal[]>(qk.goals, (old) => [
          savedGoal,
          ...(old ?? []).filter((g) => g.id !== ctx?.goalId && g.id !== savedGoal.id),
        ]);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.goals });
    },
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Goal> }) => {
      const updatedLocal = localDB.updateGoal(id, patch);
      const user = await getAuthSessionUser();
      if (!user) return updatedLocal;
      const data = await runRemote(
        { kind: "update", table: "goals", rowId: id, patch: patch as Record<string, unknown> },
        () => db.from("goals").update(patch).eq("id", id).select().maybeSingle(),
      );
      return data ?? updatedLocal;
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: qk.goals });
      const prev = qc.getQueryData<Goal[]>(qk.goals);
      localDB.updateGoal(id, patch);
      qc.setQueryData<Goal[]>(qk.goals, (old) =>
        (old ?? []).map((g) => (g.id === id ? { ...g, ...patch } : g)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.goals, ctx.prev);
    },
    onSuccess: (updatedGoal) => {
      if (updatedGoal) {
        localDB.saveGoal(updatedGoal);
        qc.setQueryData<Goal[]>(qk.goals, (old) =>
          (old ?? []).map((g) => (g.id === updatedGoal.id ? { ...g, ...updatedGoal } : g)),
        );
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.goals });
    },
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      localDB.deleteGoal(id);
      const user = await getAuthSessionUser();
      if (!user) return id;
      await runRemote({ kind: "delete", table: "goals", rowId: id }, () =>
        db.from("goals").delete().eq("id", id),
      );
      return id;
    },
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: qk.goals });
      await qc.cancelQueries({ queryKey: qk.subtasks });
      const prevGoals = qc.getQueryData<Goal[]>(qk.goals);
      const prevSubtasks = qc.getQueryData<Subtask[]>(qk.subtasks);
      localDB.deleteGoal(id);
      qc.setQueryData<Goal[]>(qk.goals, (old) => (old ?? []).filter((g) => g.id !== id));
      qc.setQueryData<Subtask[]>(qk.subtasks, (old) => (old ?? []).filter((s) => s.goal_id !== id));
      return { prevGoals, prevSubtasks };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prevGoals) qc.setQueryData(qk.goals, ctx.prevGoals);
      if (ctx?.prevSubtasks) qc.setQueryData(qk.subtasks, ctx.prevSubtasks);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.goals });
      qc.invalidateQueries({ queryKey: qk.subtasks });
    },
  });
}

/** Input for creating or updating subtasks. A row belongs to a goal (milestone) or to a
 *  task (checklist step); at least one parent must be present. */
export type SubtaskInput = Partial<Subtask> & { title: string };

export function useSaveSubtasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: SubtaskInput[]) => {
      const rowsWithId = rows.map((r) => ({
        ...r,
        id: r.id || crypto.randomUUID(),
      }));
      const created = localDB.saveSubtasks(rowsWithId);
      const user = await getAuthSessionUser();
      if (!user) return created;

      const serverRows = created.map((s) => ({ ...s, user_id: user.id }));
      const fallback = () => {
        for (const row of serverRows) {
          enqueue({ kind: "upsert", table: "subtasks", rowId: row.id, row });
        }
      };
      if (isOffline()) {
        fallback();
        return created;
      }
      try {
        const { data, error } = await db
          .from("subtasks")
          .upsert(serverRows, { onConflict: "id" })
          .select();
        if (error) {
          fallback();
          return created;
        }
        if (data && data.length > 0) {
          return localDB.saveSubtasks(data);
        }
        return created;
      } catch {
        fallback();
        return created;
      }
    },
    onMutate: async (rows) => {
      await qc.cancelQueries({ queryKey: qk.subtasks });
      const prev = qc.getQueryData<Subtask[]>(qk.subtasks) ?? [];
      const assignedRows: Subtask[] = rows.map((r, i) => {
        if (!r.id) r.id = crypto.randomUUID();
        const existing = prev.find((s) => s.id === r.id);
        return {
          id: r.id,
          goal_id: r.goal_id ?? existing?.goal_id ?? null,
          task_id: r.task_id ?? existing?.task_id ?? null,
          user_id: r.user_id ?? existing?.user_id ?? "guest_user",
          title: r.title,
          estimated_minutes: r.estimated_minutes ?? existing?.estimated_minutes ?? 30,
          target_date: r.target_date ?? existing?.target_date ?? null,
          is_completed: r.is_completed ?? existing?.is_completed ?? false,
          position: r.position ?? existing?.position ?? prev.length + i,
          completed_at: r.completed_at ?? existing?.completed_at ?? null,
          definition_of_done: r.definition_of_done ?? existing?.definition_of_done ?? null,
          parent_id: r.parent_id ?? existing?.parent_id ?? null,
          created_at: existing?.created_at ?? new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      });
      localDB.saveSubtasks(assignedRows);
      const assignedIds = new Set(assignedRows.map((r) => r.id));
      qc.setQueryData<Subtask[]>(qk.subtasks, [
        ...prev.filter((s) => !assignedIds.has(s.id)),
        ...assignedRows,
      ]);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.subtasks, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.subtasks });
    },
  });
}

export function useUpdateSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Subtask> }) => {
      const localUpdated = localDB.updateSubtask(id, patch);
      const user = await getAuthSessionUser();
      if (!user) return localUpdated;
      const data = await runRemote(
        { kind: "update", table: "subtasks", rowId: id, patch: patch as Record<string, unknown> },
        () => db.from("subtasks").update(patch).eq("id", id).select().maybeSingle(),
      );
      return data ?? localUpdated;
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: qk.subtasks });
      const prev = qc.getQueryData<Subtask[]>(qk.subtasks);
      localDB.updateSubtask(id, patch);
      qc.setQueryData<Subtask[]>(qk.subtasks, (old) =>
        (old ?? []).map((s) => (s.id === id ? { ...s, ...patch } : s)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.subtasks, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.subtasks }),
  });
}

export function useDeleteSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      localDB.deleteSubtask(id);
      const user = await getAuthSessionUser();
      if (!user) return id;
      await runRemote({ kind: "delete", table: "subtasks", rowId: id }, () =>
        db.from("subtasks").delete().eq("id", id),
      );
      return id;
    },
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: qk.subtasks });
      const prev = qc.getQueryData<Subtask[]>(qk.subtasks);
      localDB.deleteSubtask(id);
      qc.setQueryData<Subtask[]>(qk.subtasks, (old) => (old ?? []).filter((s) => s.id !== id));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.subtasks, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.subtasks }),
  });
}

export function useLogFocusSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      task_id?: string | null;
      mode: string;
      minutes: number;
      started_at: string;
    }) => {
      const local = localDB.saveFocusSession(input);
      const user = await getAuthSessionUser();
      if (!user) return;
      const row = {
        id: local.id,
        user_id: user.id,
        task_id: input.task_id ?? null,
        mode: input.mode,
        minutes: input.minutes,
        started_at: input.started_at,
        ended_at: local.ended_at,
      };
      await runRemote({ kind: "upsert", table: "focus_sessions", rowId: local.id, row }, () =>
        db.from("focus_sessions").upsert(row, { onConflict: "id" }),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.sessions }),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Profile>) => {
      localDB.saveProfile(patch);
      const user = await getAuthSessionUser();
      if (!user) return;
      const { id: _id, user_id: _uid, ...safePatch } = patch;
      await runRemote(
        {
          kind: "update",
          table: "profiles",
          rowId: user.id,
          patch: safePatch as Record<string, unknown>,
        },
        () => db.from("profiles").update(safePatch).eq("id", user.id),
      );
    },
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: qk.profile });
      const prev = qc.getQueryData<Profile | null>(qk.profile);
      qc.setQueryData<Profile | null>(qk.profile, (old) =>
        old ? { ...old, ...patch } : localDB.saveProfile(patch),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(qk.profile, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.profile }),
  });
}

export function useSaveReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Reminder> & { label: string; remind_at: string }) => {
      const local = localDB.saveReminder(input);
      const user = await getAuthSessionUser();
      if (!user) return;
      const row = { ...local, user_id: user.id };
      await runRemote({ kind: "upsert", table: "reminders", rowId: local.id, row }, () =>
        db.from("reminders").upsert(row, { onConflict: "id" }),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.reminders }),
  });
}

export function useDeleteReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      localDB.deleteReminder(id);
      const user = await getAuthSessionUser();
      if (!user) return;
      await runRemote({ kind: "delete", table: "reminders", rowId: id }, () =>
        db.from("reminders").delete().eq("id", id),
      );
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: qk.reminders });
      const prev = qc.getQueryData<Reminder[]>(qk.reminders);
      qc.setQueryData<Reminder[]>(qk.reminders, (old) => (old ?? []).filter((r) => r.id !== id));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.reminders, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.reminders }),
  });
}

export function useUnlockAchievement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (badge_key: string) => {
      const local = localDB.unlockAchievement(badge_key);
      const user = await getAuthSessionUser();
      if (!user) return;
      const row = { id: local.id, user_id: user.id, badge_key, unlocked_at: local.unlocked_at };
      await runRemote({ kind: "upsert", table: "achievements", rowId: local.id, row }, () =>
        db
          .from("achievements")
          .upsert(row, { onConflict: "user_id,badge_key", ignoreDuplicates: true }),
      );
    },
    // The local unlock is saved even if the account step fails, so always refresh.
    onSettled: () => qc.invalidateQueries({ queryKey: qk.achievements }),
  });
}

/** Squads & Accountability Circle Queries — shared with teammates through the server. */
export function useSquads() {
  return useQuery({
    queryKey: qk.squads,
    queryFn: async (): Promise<TeamSquad[]> => {
      await squadsRemote.syncSquads();
      return localDB.getSquads();
    },
    initialData: () => (typeof window === "undefined" ? undefined : localDB.getSquads()),
    initialDataUpdatedAt: 0,
    // Teammates' changes show up while the page is open.
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
}

function useSquadMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onMutate: () => qc.cancelQueries({ queryKey: qk.squads }),
    onSettled: () => {
      qc.setQueryData(qk.squads, localDB.getSquads());
    },
  });
}

export function useCreateSquad() {
  return useSquadMutation(({ name, description }: { name: string; description: string }) =>
    squadsRemote.createSharedSquad(name, description),
  );
}

export function useJoinSquad() {
  return useSquadMutation((code: string) => squadsRemote.joinSharedSquad(code));
}

export function useLeaveSquad() {
  return useSquadMutation((squadId: string) => squadsRemote.leaveSharedSquad(squadId));
}

export function useAddTeamGoal() {
  return useSquadMutation(
    async ({
      squadId,
      goal,
    }: {
      squadId: string;
      goal: Omit<TeamGoal, "id" | "squadId" | "createdAt" | "isCompleted" | "contributors">;
    }) =>
      squadsRemote.addSharedGoal(squadId, {
        title: goal.title,
        domain: goal.domain,
        targetCount: goal.targetCount,
        unit: goal.unit,
        ...(goal.deadline ? { deadline: goal.deadline } : {}),
      }),
  );
}

export function useAddTeamTask() {
  return useSquadMutation(
    async ({
      squadId,
      task,
    }: {
      squadId: string;
      task: Omit<TeamTask, "id" | "squadId" | "createdAt" | "isCompleted">;
    }) => {
      const { completedBy: _a, completedAt: _b, ...input } = task;
      return squadsRemote.addSharedTask(squadId, input);
    },
  );
}

export function useToggleTeamTask() {
  return useSquadMutation(async ({ squadId, taskId }: { squadId: string; taskId: string }) => {
    const current = localDB.getSquads().find((s) => s.id === squadId)?.tasks.find((t) => t.id === taskId);
    return squadsRemote.setSharedTaskDone(squadId, taskId, !current?.isCompleted);
  });
}

export function useCheerTeammate() {
  return useSquadMutation(({ squadId, memberId }: { squadId: string; memberId: string }) =>
    squadsRemote.cheerShared(squadId, memberId),
  );
}
