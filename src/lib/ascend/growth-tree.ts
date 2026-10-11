import { DOMAINS, type Task } from "./types";

/** Logarithmic milestones never impose a lifetime ceiling; geometry stays bounded. */
export function growthScale(count: number) {
  const total = Math.max(0, count);
  const logarithm = Math.log2(1 + total / 10);
  const rings = Math.floor(logarithm);
  const previous = 10 * (2 ** rings - 1);
  const next = 10 * (2 ** (rings + 1) - 1);
  return {
    rings,
    next,
    progress: (total - previous) / (next - previous),
    // Smooth, strictly increasing proportions, rather than a fixed completion cap.
    size: logarithm / (logarithm + 6),
    leaves: total === 0 ? 0 : Math.min(24, 2 + Math.floor(Math.log2(total + 1)) * 2),
  };
}

/** One pass over recorded history, independent of the number of calendar days. */
export function treeSummary(tasks: Task[], from: string, to: string) {
  const counts = new Map<string, number>();
  let completions = 0;
  for (const task of tasks) {
    let count = 0;
    for (const date of task.completed_dates ?? []) {
      if (date >= from && date <= to) count++;
    }
    completions += count;
    counts.set(task.domain, (counts.get(task.domain) ?? 0) + count);
  }
  return {
    completions,
    branches: DOMAINS.map((domain) => ({ ...domain, count: counts.get(domain.key) ?? 0 })),
    growth: growthScale(completions),
  };
}

export function branchGeometry(index: number, count: number, trunkHeight: number) {
  const side = index % 2 === 0 ? -1 : 1;
  const level = Math.floor(index / 2);
  const baseY = 390 - trunkHeight * (0.25 + level * 0.2);
  const length = 42 + growthScale(count).size * 108;
  return { side, baseY, length, endX: 200 + side * length, endY: baseY - 38 };
}
/** Classic tree layout in a 320×360 viewBox: branches evenly up the trunk, alternating
 *  sides. Every value is bounded because growthScale().size < 1, so it never clips. */
export const TREE_VIEW = { width: 320, height: 360, groundY: 340, topY: 40 } as const;

export function classicBranch(index: number, branchCount: number, count: number) {
  const scale = growthScale(count);
  const step = (TREE_VIEW.groundY - 70 - TREE_VIEW.topY - 30) / Math.max(1, branchCount - 1);
  const side = index % 2 === 0 ? -1 : 1;
  const baseY = TREE_VIEW.groundY - 70 - index * step;
  const length = 34 + scale.size * 90;
  return {
    scale, side, baseY, length,
    endX: 160 + side * length,
    endY: baseY - 22,
    leaves: count > 0 ? Math.max(3, Math.min(9, scale.leaves)) : 0,
    radius: 5 + scale.size * 9,
    leafR: 3 + scale.size * 2.5,
  };
}

// Seasons are derived from existing history, never saved as a second copy of data.
export const SEASON_CAPACITY = 1000;
export const SEASON_STAGES = [
  { at: 0, label: "Seedling" },
  { at: 100, label: "Growing" },
  { at: 600, label: "Mature" },
  { at: 750, label: "Blossoming" },
  { at: 900, label: "Fruiting" },
  { at: 1000, label: "Golden" },
] as const;

export function treeHistory(tasks: Task[], from: string, to: string) {
  const byDate = new Map<string, number[]>();
  for (const task of tasks) {
    const domain = DOMAINS.findIndex((d) => d.key === task.domain);
    if (domain < 0) continue;
    for (const date of task.completed_dates ?? []) {
      if (date < from || date > to) continue;
      const counts = byDate.get(date) ?? Array<number>(DOMAINS.length).fill(0);
      counts[domain] = (counts[domain] ?? 0) + 1;
      byDate.set(date, counts);
    }
  }
  const days = [...byDate].sort(([a], [b]) => a.localeCompare(b));
  const total = days.reduce((sum, [, counts]) => sum + counts.reduce((a, b) => a + b, 0), 0);
  return { days, total, seasonCount: Math.floor(total / SEASON_CAPACITY) + 1 };
}

export function seasonSummary(history: ReturnType<typeof treeHistory>, requested: number) {
  const index = Math.max(0, Math.min(history.seasonCount - 1, Math.floor(requested)));
  const start = index * SEASON_CAPACITY;
  const end = start + SEASON_CAPACITY;
  const counts = Array<number>(DOMAINS.length).fill(0);
  let cursor = 0;
  let from = "";
  let to = "";
  for (const [date, daily] of history.days) {
    for (let domain = 0; domain < daily.length; domain++) {
      const amount = daily[domain] ?? 0;
      const overlap = Math.max(0, Math.min(cursor + amount, end) - Math.max(cursor, start));
      if (overlap > 0) {
        counts[domain] = (counts[domain] ?? 0) + overlap;
        if (!from) from = date;
        to = date;
      }
      cursor += amount;
    }
    if (cursor >= end) break;
  }
  const completions = counts.reduce((a, b) => a + b, 0);
  const stage = [...SEASON_STAGES].reverse().find((s) => completions >= s.at) ?? SEASON_STAGES[0];
  const nextStage = SEASON_STAGES.find((s) => s.at > completions);
  return {
    index, from, to, stage, nextStage,
    completions,
    branches: DOMAINS.map((domain, i) => ({ ...domain, count: counts[i] ?? 0 })),
    growth: growthScale(completions),
  };
}

export const SKILL_TREE_VIEW = { width: 480, height: 400 } as const;
export function skillBranch(index: number, count: number) {
  const side = index % 2 === 0 ? -1 : 1;
  const level = Math.floor(index / 2);
  const size = Math.min(1, Math.log2(1 + Math.max(0, count)) / Math.log2(1001));
  const baseY = 290 - level * 62;
  const length = 18 + size * (148 - level * 25);
  const rise = 12 + size * 28;
  return { side, baseY, endX: 240 + side * length, endY: baseY - rise,
    nodeX: 240 + side * length * 0.64, nodeY: baseY - rise * 0.64,
    labelX: side < 0 ? 102 : 378, labelY: baseY - 59, size };
}
