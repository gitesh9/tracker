import { z } from "zod";
import { addDays } from "./cadence";
import type { Goal, Task } from "./types";

export const goalStepSchema = z.object({
  title: z.string().trim().min(5).max(160),
  definition_of_done: z.string().trim().min(10).max(600),
  estimated_minutes: z.number().int().min(5).max(60),
  frequency_type: z.enum(["daily", "weekdays", "weekly_count", "once"]),
  frequency_days: z.number().int().min(1).max(365).nullable(),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7),
  target_days_per_week: z.number().int().min(0).max(7),
  start_day: z.number().int().min(0),
  schedule_reason: z.string().trim().min(5).max(400),
}).superRefine((step, ctx) => {
  if (step.frequency_type === "weekdays" && step.weekdays.length === 0)
    ctx.addIssue({ code: "custom", message: "Choose at least one weekday" });
  if (step.frequency_type === "weekly_count" && step.target_days_per_week < 1)
    ctx.addIssue({ code: "custom", message: "Choose a weekly target" });
});

export type GoalPlanStep = z.infer<typeof goalStepSchema>;

export const goalPlanSchema = z.object({ subtasks: z.array(goalStepSchema).min(1).max(10) });
export const milestonePlanSchema = z.object({ milestones: z.array(z.object({
  title: z.string().trim().min(5).max(160),
  definition_of_done: z.string().trim().min(10).max(600),
  target_day: z.number().int().min(0),
})).min(1).max(6) });
export type GoalMilestone = z.infer<typeof milestonePlanSchema>["milestones"][number];

export function parseMilestonePlan(raw: string, targetDays: number): GoalMilestone[] {
  const plan = milestonePlanSchema.parse(JSON.parse(raw.replace(/```json|```/g, "").trim()));
  if (plan.milestones.some((m) => m.target_day >= targetDays))
    throw new Error("A milestone falls outside the goal horizon");
  return plan.milestones;
}

export function parseGoalPlan(raw: string, targetDays: number): GoalPlanStep[] {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const plan = goalPlanSchema.parse(JSON.parse(cleaned));
  if (plan.subtasks.some((step) => step.start_day >= targetDays))
    throw new Error("A step starts after the goal horizon");
  return plan.subtasks;
}

export function goalStepTask(step: GoalPlanStep, goal: Goal, startDate: string): Partial<Task> & { title: string } {
  return {
    title: step.title,
    definition_of_done: step.definition_of_done,
    estimated_minutes: step.estimated_minutes,
    frequency_type: step.frequency_type,
    frequency_days: step.frequency_type === "daily" ? (step.frequency_days ?? 1) : null,
    weekdays: step.frequency_type === "weekdays" ? [...new Set(step.weekdays)] : [],
    target_days_per_week: step.frequency_type === "weekly_count" ? step.target_days_per_week : 0,
    due_date: addDays(startDate, step.start_day),
    goal_id: goal.id,
    domain: goal.domain,
    categories: [goal.domain],
    priority: "medium",
    energy_level: "medium",
    icon_name: goal.icon_name || "target",
    notes: step.schedule_reason,
    is_ai_enabled: true,
  };
}