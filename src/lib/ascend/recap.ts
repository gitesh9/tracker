import type { Task } from "./types";
import { addDays } from "./cadence";

export interface WeeklyRecap {
  start: string;
  end: string;
  completions: number;
  activeDays: number;
  topDomain: string | null;
  bestDay: string | null;
  perDomain: Record<string, number>;
}

/** The last seven days ending on `endISO` (inclusive). */
export function weeklyRecap(tasks: Task[], endISO: string): WeeklyRecap {
  const start = addDays(endISO, -6);
  const perDomain: Record<string, number> = {};
  const perDay: Record<string, number> = {};
  let completions = 0;
  for (const t of tasks) {
    for (const d of t.completed_dates ?? []) {
      if (d < start || d > endISO) continue;
      completions++;
      perDay[d] = (perDay[d] ?? 0) + 1;
      const dom = t.domain || "focus";
      perDomain[dom] = (perDomain[dom] ?? 0) + 1;
    }
  }
  const pick = (r: Record<string, number>) =>
    Object.entries(r).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
  return {
    start,
    end: endISO,
    completions,
    activeDays: Object.keys(perDay).length,
    topDomain: pick(perDomain),
    bestDay: pick(perDay),
    perDomain,
  };
}
