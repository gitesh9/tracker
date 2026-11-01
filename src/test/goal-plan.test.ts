import { describe, expect, it } from "vitest";
import { goalStepTask, parseGoalPlan, parseMilestonePlan, type GoalPlanStep } from "@/lib/ascend/goal-plan";
import { isDueOn } from "@/lib/ascend/cadence";
import type { Goal, Task } from "@/lib/ascend/types";

const step: GoalPlanStep = {
  title: "Solve 3 two-pointer problems",
  definition_of_done: "Three solutions pass examples with time and space complexity noted.",
  estimated_minutes: 30,
  frequency_type: "daily", frequency_days: 1, weekdays: [], target_days_per_week: 0,
  start_day: 0, schedule_reason: "Regular practice builds fluency.",
};
const goal = { id: "goal-1", domain: "learning", icon_name: "book" } as Goal;
const task = (patch: Partial<GoalPlanStep> = {}) => ({
  ...goalStepTask({ ...step, ...patch }, goal, "2026-10-31"),
  is_completed: false, completed_dates: [],
}) as Task;

describe("AI goal schedules", () => {
  it("requires observable milestone evidence rather than title-only outcomes", () => {
    expect(() => parseMilestonePlan(JSON.stringify({ milestones: [{ title: "Ship a working beta", target_day: 14 }] }), 90)).toThrow();
    expect(parseMilestonePlan(JSON.stringify({ milestones: [{ title: "Ship a working beta", definition_of_done: "Three invited users complete the core workflow successfully.", target_day: 14 }] }), 90)[0]?.target_day).toBe(14);
  });
  it("rejects milestones outside the specified horizon", () => {
    expect(() => parseMilestonePlan(JSON.stringify({ milestones: [{ title: "Ship a working beta", definition_of_done: "Three invited users complete the core workflow successfully.", target_day: 90 }] }), 90)).toThrow();
  });
  it("creates a goal-linked daily step visible on Today", () => {
    const t = task();
    expect(t.goal_id).toBe("goal-1");
    expect(t.definition_of_done).toBe(step.definition_of_done);
    expect(isDueOn(t, "2026-10-31")).toBe(true);
    expect(isDueOn(t, "2026-11-01")).toBe(true);
  });
  it("alternate days recur every two days, including across a week boundary", () => {
    const t = task({ frequency_days: 2 });
    expect(isDueOn(t, "2026-10-31")).toBe(true);
    expect(isDueOn(t, "2026-11-01")).toBe(false);
    expect(isDueOn(t, "2026-11-02")).toBe(true);
    expect(isDueOn(t, "2026-11-07")).toBe(false);
    expect(isDueOn(t, "2026-11-08")).toBe(true);
  });
  it("once a week on Saturday is hidden on other days", () => {
    const t = task({ frequency_type: "weekdays", weekdays: [6] });
    expect(isDueOn(t, "2026-10-31")).toBe(true);
    expect(isDueOn(t, "2026-11-01")).toBe(false);
    expect(isDueOn(t, "2026-11-07")).toBe(true);
  });
  it("future steps cannot appear before their start date for any cadence", () => {
    for (const frequency_type of ["daily", "weekdays", "weekly_count", "once"] as const) {
      const t = task({ start_day: 7, frequency_type, weekdays: [6], target_days_per_week: 1 });
      expect(isDueOn(t, "2026-10-31")).toBe(false);
      expect(isDueOn(t, "2026-11-07")).toBe(true);
    }
  });
  it("a flexible weekly session stops being due after the weekly quota", () => {
    const t = task({ frequency_type: "weekly_count", target_days_per_week: 1 });
    t.completed_dates = ["2026-10-31"];
    expect(isDueOn(t, "2026-11-01")).toBe(false);
    expect(isDueOn(t, "2026-11-02")).toBe(true);
  });
  it("validates schedules rather than silently replacing missing fields with vague steps", () => {
    expect(parseGoalPlan(JSON.stringify({ subtasks: [step] }), 90)).toEqual([step]);
    expect(() => parseGoalPlan(JSON.stringify({ subtasks: [{ title: "Execute milestone" }] }), 90)).toThrow();
    expect(() => parseGoalPlan(JSON.stringify({ subtasks: [{ ...step, start_day: 90 }] }), 90)).toThrow();
    expect(() => parseGoalPlan(JSON.stringify({ subtasks: [{ ...step, frequency_type: "weekdays", weekdays: [] }] }), 90)).toThrow();
  });
});