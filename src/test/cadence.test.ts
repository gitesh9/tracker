import { describe, expect, it } from "vitest";
import { computeStreak, isCarriedForward, isDueOn, weekProgress } from "@/lib/ascend/cadence";
import type { Task } from "@/lib/ascend/types";

const task = (patch: Partial<Task>) =>
  ({ frequency_type: "daily", completed_dates: [], weekdays: [], due_date: "2026-10-05", is_completed: false, target_days_per_week: 3, ...patch }) as Task;

describe("repeating schedules", () => {
  it("keeps yesterday's streak when today is unfinished", () => {
    expect(computeStreak([task({ completed_dates: ["2026-10-07", "2026-10-08"] })], "2026-10-09")).toBe(2);
  });

  it("ignores dates before creation and unscheduled weekdays", () => {
    expect(computeStreak([task({ frequency_type: "weekdays", weekdays: [4], created_at: "2026-10-07T12:00:00", completed_dates: ["2026-10-08"] })], "2026-10-09")).toBe(1);
    expect(computeStreak([], "2026-10-09")).toBe(0);
  });
  it("daily tasks are due every day", () => {
    expect(isDueOn(task({}), "2026-10-08")).toBe(true);
  });

  it("weekday tasks are due only on chosen days", () => {
    // 2026-10-08 is a Thursday (4)
    expect(isDueOn(task({ frequency_type: "weekdays", weekdays: [4] }), "2026-10-08")).toBe(true);
    expect(isDueOn(task({ frequency_type: "weekdays", weekdays: [1] }), "2026-10-08")).toBe(false);
  });

  it("weekly targets stop showing once met", () => {
    const t = task({ frequency_type: "weekly_count", target_days_per_week: 2, completed_dates: ["2026-10-05", "2026-10-06"] });
    expect(isDueOn(t, "2026-10-08")).toBe(false);
    expect(weekProgress(t, "2026-10-08").done).toBe(2);
  });

  it("only one-off tasks carry forward", () => {
    expect(isCarriedForward(task({ frequency_type: "once" }), "2026-10-08")).toBe(true);
    expect(isCarriedForward(task({}), "2026-10-08")).toBe(false);
  });
});
