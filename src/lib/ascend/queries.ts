import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  Achievement,
  DeferralLog,
  FocusSession,
  Goal,
  Profile,
  Reminder,
  Subtask,
  Task,
} from "./types";
import { computeStreak, todayISO } from "./cadence";
import { enqueue, isOffline } from "./offline";

export const qk = {
  profile: ["profile"] as const,
  tasks: ["tasks"] as const,
  goals: ["goals"] as const,
  subtasks: ["subtasks"] as const,
  deferrals: ["deferrals"] as const,
  achievements: ["achievements"] as const,
  sessions: ["focus_sessions"] as const,
  reminders: ["reminders"] as const,
};

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

export function useProfile() {
  return useQuery({
    queryKey: qk.profile,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase.from("profiles").select("*").maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

export function useTasks() {
  return useQuery({
    queryKey: qk.tasks,
    queryFn: async (): Promise<Task[]> =>
      unwrap(await supabase.from("tasks").select("*").order("created_at", { ascending: false })),
  });
}

export function useGoals() {
  return useQuery({
    queryKey: qk.goals,
    queryFn: async (): Promise<Goal[]> =>
      unwrap(await supabase.from("goals").select("*").order("created_at", { ascending: false })),
  });
}

export function useSubtasks() {
  return useQuery({
    queryKey: qk.subtasks,
    queryFn: async (): Promise<Subtask[]> =>
      unwrap(await supabase.from("subtasks").select("*").order("position", { ascending: true })),
  });
}

export function useDeferrals() {
  return useQuery({
    queryKey: qk.deferrals,
    queryFn: async (): Promise<DeferralLog[]> =>
      unwrap(await supabase.from("deferral_logs").select("*").order("logged_at", { ascending: false })),
  });
}

export function useAchievements() {
  return useQuery({
    queryKey: qk.achievements,
    queryFn: async (): Promise<Achievement[]> =>
      unwrap(await supabase.from("achievements").select("*").order("unlocked_at", { ascending: false })),
  });
}

export function useFocusSessions() {
  return useQuery({
    queryKey: qk.sessions,
    queryFn: async (): Promise<FocusSession[]> =>
      unwrap(await supabase.from("focus_sessions").select("*").order("started_at", { ascending: false })),
  });
}

export function useReminders() {
  return useQuery({
    queryKey: qk.reminders,
    queryFn: async (): Promise<Reminder[]> =>
      unwrap(await supabase.from("reminders").select("*").order("remind_at", { ascending: true })),
  });
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return data.user.id;
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Task> & { title: string }) => {
      const user_id = await currentUserId();
      const { data, error } = await supabase
        .from("tasks")
        .insert({ ...input, user_id })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.tasks }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Task> }) => {
      if (isOffline()) {
        enqueue({ kind: "task_update", taskId: id, patch });
        return;
      }
      const { error } = await supabase.from("tasks").update(patch).eq("id", id);
      if (error) {
        // Treat a failed write while the network flaps as an offline write.
        enqueue({ kind: "task_update", taskId: id, patch });
        return;
      }
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: qk.tasks });
      const prev = qc.getQueryData<Task[]>(qk.tasks);
      qc.setQueryData<Task[]>(qk.tasks, (old) =>
        (old ?? []).map((t) => (t.id === id ? { ...t, ...patch } : t)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.tasks, ctx.prev);
    },
    onSettled: () => {
      if (!isOffline()) qc.invalidateQueries({ queryKey: qk.tasks });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.tasks }),
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
      const user_id = await currentUserId();
      const { error } = await supabase
        .from("deferral_logs")
        .insert({ task_id, user_id, reason_category, notes: notes ?? null });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.deferrals }),
  });
}

export function useSaveGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Goal> & { title: string }) => {
      const user_id = await currentUserId();
      if (input.id) {
        const { error } = await supabase.from("goals").update(input).eq("id", input.id);
        if (error) throw new Error(error.message);
        return input.id;
      }
      const { data, error } = await supabase
        .from("goals")
        .insert({ ...input, user_id })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.goals }),
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("goals").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.goals });
      qc.invalidateQueries({ queryKey: qk.subtasks });
    },
  });
}

export function useSaveSubtasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: (Partial<Subtask> & { goal_id: string; title: string })[]) => {
      const user_id = await currentUserId();
      const { error } = await supabase
        .from("subtasks")
        .insert(rows.map((r) => ({ ...r, user_id })));
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.subtasks }),
  });
}

export function useUpdateSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Subtask> }) => {
      const { error } = await supabase.from("subtasks").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: qk.subtasks });
      const prev = qc.getQueryData<Subtask[]>(qk.subtasks);
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
      const { error } = await supabase.from("subtasks").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.subtasks }),
  });
}

export function useLogFocusSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { task_id?: string | null; mode: string; minutes: number; started_at: string }) => {
      const user_id = await currentUserId();
      const { error } = await supabase.from("focus_sessions").insert({
        user_id,
        task_id: input.task_id ?? null,
        mode: input.mode,
        minutes: input.minutes,
        started_at: input.started_at,
        ended_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.sessions }),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Profile>) => {
      const id = await currentUserId();
      const { error } = await supabase.from("profiles").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.profile }),
  });
}

export function useSaveReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Reminder> & { label: string; remind_at: string }) => {
      const user_id = await currentUserId();
      if (input.id) {
        const { error } = await supabase.from("reminders").update(input).eq("id", input.id);
        if (error) throw new Error(error.message);
        return;
      }
      const { error } = await supabase.from("reminders").insert({ ...input, user_id });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.reminders }),
  });
}

export function useDeleteReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reminders").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.reminders }),
  });
}

export function useUnlockAchievement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (badge_key: string) => {
      const user_id = await currentUserId();
      const { error } = await supabase
        .from("achievements")
        .upsert({ user_id, badge_key }, { onConflict: "user_id,badge_key", ignoreDuplicates: true });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.achievements }),
  });
}

/** Keeps the stored streak in sync with what the task history implies. */
export function useSyncStreak() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tasks: Task[]) => {
      const id = await currentUserId();
      const streak = computeStreak(tasks);
      const { data: profile } = await supabase.from("profiles").select("longest_streak").eq("id", id).maybeSingle();
      const longest = Math.max(streak, profile?.longest_streak ?? 0);
      const { error } = await supabase
        .from("profiles")
        .update({ current_streak: streak, longest_streak: longest, last_active_date: todayISO() })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.profile }),
  });
}
