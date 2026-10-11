import type { FocusSession, Goal, Profile, Subtask, Task } from "./types";

export type Badge = {
  key: string;
  label: string;
  description: string;
  tier: "bronze" | "silver" | "gold";
};

export const BADGES: Badge[] = [
  {
    key: "first_step",
    label: "First Step",
    description: "Complete your first task",
    tier: "bronze",
  },
  { key: "ten_done", label: "Ten Up", description: "Complete 10 tasks", tier: "bronze" },
  { key: "fifty_done", label: "Half Century", description: "Complete 50 tasks", tier: "silver" },
  { key: "two_hundred_done", label: "Relentless", description: "Complete 200 tasks", tier: "gold" },
  { key: "streak_3", label: "Warm Up", description: "Hold a 3-day streak", tier: "bronze" },
  { key: "streak_7", label: "Week Strong", description: "Hold a 7-day streak", tier: "silver" },
  { key: "streak_30", label: "Unbroken", description: "Hold a 30-day streak", tier: "gold" },
  { key: "focus_60", label: "Deep Hour", description: "Log 60 focus minutes", tier: "bronze" },
  {
    key: "focus_600",
    label: "Ten Hours Deep",
    description: "Log 600 focus minutes",
    tier: "silver",
  },
  {
    key: "goal_done",
    label: "Goal Crusher",
    description: "Finish every subtask of a goal",
    tier: "gold",
  },
  {
    key: "all_domains",
    label: "Balanced",
    description: "Complete a task in all four domains",
    tier: "silver",
  },
];

export function earnedBadgeKeys(input: {
  tasks: Task[];
  goals: Goal[];
  subtasks: Subtask[];
  sessions: FocusSession[];
  profile: Profile | null | undefined;
}): string[] {
  const { tasks, goals, subtasks, sessions, profile } = input;
  const completions = tasks.reduce((n, t) => n + (t.completed_dates?.length ?? 0), 0);
  const minutes = sessions.reduce((n, s) => n + Number(s.minutes ?? 0), 0);
  const streak = profile?.current_streak ?? 0;
  const domainsHit = new Set(
    tasks.filter((t) => (t.completed_dates?.length ?? 0) > 0).map((t) => t.domain),
  );
  const goalDone = goals.some((g) => {
    const kids = subtasks.filter((s) => s.goal_id === g.id);
    return kids.length > 0 && kids.every((s) => s.is_completed);
  });

  const earned: string[] = [];
  if (completions >= 1) earned.push("first_step");
  if (completions >= 10) earned.push("ten_done");
  if (completions >= 50) earned.push("fifty_done");
  if (completions >= 200) earned.push("two_hundred_done");
  if (streak >= 3) earned.push("streak_3");
  if (streak >= 7) earned.push("streak_7");
  if (streak >= 30) earned.push("streak_30");
  if (minutes >= 60) earned.push("focus_60");
  if (minutes >= 600) earned.push("focus_600");
  if (goalDone) earned.push("goal_done");
  if (domainsHit.size >= 4) earned.push("all_domains");
  return earned;
}
