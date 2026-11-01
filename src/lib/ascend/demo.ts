import { localDb as db } from "@/lib/db/pglite";
import { localDB } from "./local-store";
import type { Task } from "./types";

/** Sample-data rows live only on this device: they are never queued and are
 *  filtered out of the full account upload by id. */
const DEMO_KEY = "ascend.demo.ids.v1";

export function getDemoIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DEMO_KEY);
    const ids = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function isDemoActive(): boolean {
  return getDemoIds().length > 0;
}

export function isDemoId(id: string): boolean {
  return getDemoIds().includes(id);
}

function isoDaysAgo(n: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Deterministic sample week: which past days (0 = today) each task was done. */
export function buildDemoTasks(now = new Date()): Array<Partial<Task> & { title: string }> {
  const plan: Array<[string, string, number, number[]]> = [
    ["Morning run 30 min", "health", 30, [1, 2, 3, 5, 6, 8, 9, 10, 12, 13]],
    ["Deep work block", "focus", 90, [1, 2, 3, 4, 7, 8, 9, 11]],
    ["Read 20 pages", "learning", 25, [1, 2, 4, 5, 6, 8, 11, 12, 13]],
    ["Journal three lines", "mindset", 5, [1, 2, 3, 4, 5, 6, 7, 9, 10]],
    ["Review spending", "finance", 15, [2, 9]],
    ["Sketch for 15 min", "creativity", 15, [3, 6, 10]],
    ["Call a friend", "relationships", 20, [4, 11]],
    ["Ship one pull request", "career", 60, [1, 3, 5, 8, 10, 12]],
  ];
  return plan.map(([title, domain, minutes, days]) => ({
    id: crypto.randomUUID(),
    title,
    domain,
    categories: [domain],
    estimated_minutes: minutes,
    frequency_type: "daily",
    due_date: isoDaysAgo(0, now),
    completed_dates: days.map((d) => isoDaysAgo(d, now)),
    is_completed: false,
  }));
}

export async function loadDemoData(): Promise<void> {
  if (isDemoActive()) return;
  const tasks = buildDemoTasks();
  window.localStorage.setItem(DEMO_KEY, JSON.stringify(tasks.map((t) => t.id)));
  for (const t of tasks) {
    const row = localDB.saveTask(t);
    await db.from("tasks").upsert(row as unknown as Record<string, unknown>, { onConflict: "id" });
  }
}

export async function clearDemoData(): Promise<void> {
  const ids = getDemoIds();
  for (const id of ids) {
    localDB.deleteTask(id);
    await db.from("tasks").delete().eq("id", id);
  }
  window.localStorage.removeItem(DEMO_KEY);
}
