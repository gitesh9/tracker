import type { Goal, Subtask, Task } from "./types";

export const todayISO = () => toISO(new Date());

export function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

export function addDays(iso: string, days: number): string {
  const date = fromISO(iso);
  date.setDate(date.getDate() + days);
  return toISO(date);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86_400_000);
}

export function startOfWeekISO(iso: string): string {
  const date = fromISO(iso);
  const day = (date.getDay() + 6) % 7; // Monday-first
  date.setDate(date.getDate() - day);
  return toISO(date);
}

export function isCompletedOn(task: Task, iso: string): boolean {
  return (task.completed_dates ?? []).includes(iso);
}

/** Is the task expected on this date given its cadence? */
export function isDueOn(task: Task, iso: string): boolean {
  if (task.is_completed) return false;
  switch (task.frequency_type) {
    case "daily":
      return true;
    case "weekdays":
      return (task.weekdays ?? []).includes(fromISO(iso).getDay());
    case "weekly_count": {
      if (isCompletedOn(task, iso)) return true;
      const weekStart = startOfWeekISO(iso);
      const done = (task.completed_dates ?? []).filter(
        (d) => d >= weekStart && d <= iso,
      ).length;
      return done < (task.target_days_per_week || 1);
    }
    default:
      return task.due_date <= iso;
  }
}

/** A one-off task that slipped past its due date. Flexible cadences never carry forward. */
export function isCarriedForward(task: Task, iso: string): boolean {
  if (task.is_completed) return false;
  if (task.frequency_type !== "once") return false;
  return task.due_date < iso;
}

export function weekProgress(task: Task, iso: string): { done: number; target: number } {
  const weekStart = startOfWeekISO(iso);
  const done = (task.completed_dates ?? []).filter((d) => d >= weekStart && d <= iso).length;
  return { done, target: task.target_days_per_week || 1 };
}

export function cadenceLabel(task: Task): string {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  switch (task.frequency_type) {
    case "daily":
      return "Daily";
    case "weekly_count":
      return `${task.target_days_per_week}× per week`;
    case "weekdays":
      return (task.weekdays ?? []).map((d) => names[d]).join(" · ") || "Custom days";
    default:
      return "One-off";
  }
}

/** Streak across all tasks: a day counts when every due task that day was completed. */
export function computeStreak(tasks: Task[], iso = todayISO()): number {
  let streak = 0;
  let cursor = iso;
  for (let i = 0; i < 400; i++) {
    const due = tasks.filter((t) => isDueOnHistorical(t, cursor));
    if (due.length === 0) {
      if (i === 0) {
        cursor = addDays(cursor, -1);
        continue;
      }
      cursor = addDays(cursor, -1);
      continue;
    }
    const allDone = due.every((t) => isCompletedOn(t, cursor));
    if (!allDone) {
      if (i === 0) {
        cursor = addDays(cursor, -1);
        continue;
      }
      break;
    }
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function isDueOnHistorical(task: Task, iso: string): boolean {
  if (task.created_at && toISO(new Date(task.created_at)) > iso) return false;
  switch (task.frequency_type) {
    case "daily":
      return true;
    case "weekdays":
      return (task.weekdays ?? []).includes(fromISO(iso).getDay());
    case "weekly_count":
      return isCompletedOn(task, iso);
    default:
      return task.due_date === iso || isCompletedOn(task, iso);
  }
}

export function completionsInRange(tasks: Task[], from: string, to: string): number {
  return tasks.reduce(
    (sum, t) => sum + (t.completed_dates ?? []).filter((d) => d >= from && d <= to).length,
    0,
  );
}

/** Velocity: how the current pace maps onto the goal's projected completion date. */
export function goalVelocity(goal: Goal, subtasks: Subtask[]) {
  const total = subtasks.length;
  const done = subtasks.filter((s) => s.is_completed).length;
  const ratio = total === 0 ? (goal.is_completed ? 1 : 0) : done / total;
  const started = toISO(new Date(goal.created_at));
  const elapsed = Math.max(1, daysBetween(started, todayISO()));
  const expected = Math.min(1, elapsed / Math.max(1, goal.target_days));
  const perDay = done / elapsed;
  const remaining = total - done;
  const projected =
    perDay > 0 && remaining > 0
      ? addDays(todayISO(), Math.ceil(remaining / perDay))
      : addDays(started, goal.target_days);
  const baseline = addDays(started, goal.target_days);
  return {
    total,
    done,
    ratio,
    expected,
    projected,
    baseline,
    daysAhead: daysBetween(projected, baseline),
    onTrack: ratio >= expected - 0.001,
  };
}
