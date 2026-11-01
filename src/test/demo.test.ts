import { describe, expect, it } from "vitest";
import { buildDemoTasks } from "@/lib/ascend/demo";

describe("sample data", () => {
  it("covers all eight life areas with past completions only", () => {
    const now = new Date(2026, 9, 28);
    const tasks = buildDemoTasks(now);
    expect(new Set(tasks.map((t) => t.domain)).size).toBe(8);
    for (const t of tasks) {
      for (const d of t.completed_dates ?? []) expect(d < "2026-10-28").toBe(true);
    }
  });
});
