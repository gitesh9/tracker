import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  ChevronDown,
  Edit3,
  Loader2,
  Plus,
  Sparkles,
  Target,
  Trash2,
  Users2,
  CalendarPlus,
  ArrowRight,
} from "lucide-react";
import {
  useCreateTask,
  useDeleteGoal,
  useDeleteSubtask,
  useGoals,
  useSaveGoal,
  useSaveSubtasks,
  useSubtasks,
  useUpdateGoal,
  useUpdateSubtask,
  useTasks,
} from "@/lib/ascend/queries";
import { goalVelocity, fromISO, todayISO, cadenceLabel, addDays } from "@/lib/ascend/cadence";
import { goalStepTask } from "@/lib/ascend/goal-plan";
import { breakdownGoal, generateGoalMilestones } from "@/lib/ascend/ai.functions";
import { DOMAINS, DOMAIN_TOKEN, type Domain, type Goal, type Subtask } from "@/lib/ascend/types";
import { iconFor } from "@/lib/ascend/icons";
import { EditGoalDialog } from "@/components/ascend/EditGoalDialog";
import { ProgressRing } from "@/components/ascend/ProgressRing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ascend/EmptyState";

export const Route = createFileRoute("/_authenticated/goals")({
  validateSearch: (search: Record<string, unknown>) => ({ goal: typeof search["goal"] === "string" ? search["goal"] : undefined }),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Goals — Ascend" },
      {
        name: "description",
        content: "Break long-term goals into milestones and watch your velocity.",
      },
      { property: "og:title", content: "Goals — Ascend" },
      { property: "og:description", content: "Milestones, velocity and projected finish dates." },
    ],
  }),
  component: GoalsPage,
});

function GoalsPage() {
  const search = Route.useSearch();
  const { data: goals = [] } = useGoals();
  const { data: subtasks = [] } = useSubtasks();
  const { data: tasks = [] } = useTasks();
  const saveGoal = useSaveGoal();
  const updateGoal = useUpdateGoal();
  const deleteGoal = useDeleteGoal();
  const saveSubtasks = useSaveSubtasks();
  const updateSubtask = useUpdateSubtask();
  const deleteSubtask = useDeleteSubtask();
  const createTask = useCreateTask();
  const breakdown = useServerFn(breakdownGoal);
  const milestonesAi = useServerFn(generateGoalMilestones);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [domain, setDomain] = useState<Domain>("career");
  const [targetDays, setTargetDays] = useState(90);
  const [expanded, setExpanded] = useState<string | null>(search.goal ?? null);
  const [busyGoal, setBusyGoal] = useState<string | null>(null);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  // Manual milestone add state
  const [addingMilestoneGoalId, setAddingMilestoneGoalId] = useState<string | null>(null);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
  const [newMilestoneDod, setNewMilestoneDod] = useState("");
  const [confirmingMilestone, setConfirmingMilestone] = useState<Subtask | null>(null);

  const runMilestones = async (goal: Goal) => {
    if (busyGoal) return;
    setBusyGoal(goal.id);
    try {
      const items = subtasks.filter((s) => s.goal_id === goal.id);
      const result = await milestonesAi({ data: { title: goal.title, description: goal.description ?? "", targetDays: goal.target_days, existingSteps: items.map((s) => s.title) } });
      await saveSubtasks.mutateAsync(result.milestones.map((m, i) => ({ goal_id: goal.id, title: m.title, definition_of_done: m.definition_of_done, target_date: addDays(todayISO(), m.target_day), position: items.length + i })));
      toast.success(`${result.milestones.length} milestones added`);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Milestone planning failed"); }
    finally { setBusyGoal(null); }
  };

  const create = async () => {
    if (!title.trim()) return;
    const createdGoal = await saveGoal.mutateAsync({
      title: title.trim(),
      description,
      domain,
      target_days: targetDays,
    });
    setOpen(false);
    setTitle("");
    setDescription("");
    toast.success("Goal created");
    if (createdGoal && typeof createdGoal === "object" && "id" in createdGoal) {
      setExpanded(createdGoal.id);
    }
  };

  const handleAddMilestone = async (goalId: string) => {
    if (!newMilestoneTitle.trim()) return;
    const existing = subtasks.filter((s) => s.goal_id === goalId);
    await saveSubtasks.mutateAsync([
      {
        goal_id: goalId,
        title: newMilestoneTitle.trim(),
        definition_of_done: newMilestoneDod.trim() || null,
        position: existing.length,
      },
    ]);
    setNewMilestoneTitle("");
    setNewMilestoneDod("");
    setAddingMilestoneGoalId(null);
    toast.success("Milestone added");
  };

  const handleConvertToTask = (goal: Goal, subtask: Subtask) => {
    createTask.mutate({
      title: subtask.title,
      definition_of_done: subtask.definition_of_done ?? null,
      domain: (goal.domain as Domain) || "career",
      categories: [goal.domain || "career", "milestone"],
      goal_id: goal.id,
      priority: "high",
      energy_level: "high",
      frequency_type: "once",
      target_days_per_week: 0,
      weekdays: [],
      estimated_minutes: subtask.estimated_minutes || 45,
      due_date: todayISO(),
      icon_name: goal.icon_name || "target",
    });
    toast.success(`Converted “${subtask.title}” to an active task for today!`);
  };

  const runBreakdown = async (
    goalId: string,
    goalTitle: string,
    goalDesc: string,
    days: number,
  ) => {
    if (busyGoal) return;
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;
    setBusyGoal(goalId);
    try {
      const result = await breakdown({
        data: { title: goalTitle, description: goalDesc, targetDays: days, domain: goal.domain,
          existingSteps: subtasks.filter((s) => s.goal_id === goalId).map((s) => s.title) },
      });
      if (result.subtasks.length === 0) {
        toast("AI couldn't split this one — try a more specific goal.");
        return;
      }
      const startDate = todayISO();
      const position = subtasks.filter((s) => s.goal_id === goalId).length;
      for (const [i, s] of result.subtasks.entries()) {
        const task = await createTask.mutateAsync(goalStepTask(s, goal, startDate));
        await saveSubtasks.mutateAsync([{
          goal_id: goalId,
          task_id: task.id,
          title: s.title,
          definition_of_done: s.definition_of_done,
          estimated_minutes: s.estimated_minutes,
          target_date: task.due_date,
          position: position + i,
        }]);
      }
      toast.success(`${result.subtasks.length} steps scheduled`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Breakdown failed");
    } finally {
      setBusyGoal(null);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Goals</h1>
          <p className="text-sm text-muted-foreground">{goals.length} in flight</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/team"
            className="flex h-8 items-center gap-1.5 rounded-lg border border-border/70 bg-surface px-2.5 text-xs font-semibold text-foreground hover:border-primary/50 transition-colors"
          >
            <Users2 className="size-3.5 text-primary" />
            <span>Squad Goals</span>
          </Link>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" style={{ backgroundImage: "var(--gradient-aurora)" }}>
                <Plus className="size-4" /> New Goal
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create Long-Term Goal</DialogTitle>
              </DialogHeader>
              <div className="space-y-3.5 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="goal-title" className="text-xs font-semibold">
                    Goal Objective
                  </Label>
                  <Input
                    id="goal-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Launch SaaS beta to 100 users"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Domain / Category</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {DOMAINS.map((d) => (
                      <button
                        key={d.key}
                        type="button"
                        onClick={() => setDomain(d.key)}
                        className={cn(
                          "rounded-lg border px-2 py-1.5 text-xs font-medium transition-all text-left truncate cursor-pointer",
                          domain === d.key
                            ? "border-primary font-semibold"
                            : "border-border/60 bg-surface/50 text-muted-foreground hover:text-foreground",
                        )}
                        style={
                          domain === d.key
                            ? {
                                background: `color-mix(in oklab, ${d.token} 18%, transparent)`,
                                color: d.token,
                                borderColor: d.token,
                              }
                            : undefined
                        }
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="goal-desc" className="text-xs font-semibold">
                    Context & Success Criteria
                  </Label>
                  <Textarea
                    id="goal-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="Where you're starting from, constraints, what success looks like."
                    className="text-xs resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="goal-days" className="text-xs font-semibold">
                    Target Horizon (Days)
                  </Label>
                  <Input
                    id="goal-days"
                    type="number"
                    min={7}
                    value={targetDays}
                    onChange={(e) => setTargetDays(Number(e.target.value))}
                    className="h-9 text-xs"
                  />
                </div>
              </div>
              <DialogFooter className="pt-2">
                <Button
                  onClick={create}
                  className="w-full sm:w-auto font-semibold"
                  style={{ backgroundImage: "var(--gradient-aurora)" }}
                >
                  Create Goal
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {goals.length === 0 && (
        <EmptyState icon={Target} title="Name your first summit">
          <Button
            className="mt-5 font-semibold"
            style={{ backgroundImage: "var(--gradient-aurora)" }}
            onClick={() => setOpen(true)}
          >
            <Plus className="size-4" /> Create a goal
          </Button>
        </EmptyState>
      )}

      <div className="space-y-4">
        {goals.map((goal) => {
          const items = subtasks.filter((s) => s.goal_id === goal.id).sort((a, b) => Number(Boolean(b.task_id)) - Number(Boolean(a.task_id)) || a.position - b.position);
          const milestoneItems = items.filter((s) => !s.task_id);
          const v = goalVelocity(goal, milestoneItems);
          const isOpen = expanded === goal.id;
          const goalDomain = (goal.domain as Domain) || "career";
          const domainColor = DOMAIN_TOKEN[goalDomain] ?? "var(--primary)";
          const GoalIcon = iconFor(goal.icon_name || "target");

          return (
            <motion.article
              layout
              key={goal.id}
              className="rounded-2xl border border-border bg-surface p-4 transition-all duration-200 hover:border-primary/40 hover:bg-surface-raised/60 hover:shadow-md"
            >
              <div className="flex flex-wrap items-start gap-3">
                <ProgressRing value={v.ratio} size={64} stroke={6}>
                  <span className="font-display text-sm font-semibold">
                    {Math.round(v.ratio * 100)}%
                  </span>
                </ProgressRing>

                <div className="min-w-0 flex-1 basis-36">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex size-5 items-center justify-center rounded"
                      style={{ color: domainColor }}
                    >
                      <GoalIcon className="size-4" />
                    </span>
                    <h2 className="min-w-0 break-words font-display text-lg font-semibold leading-tight text-foreground">
                      {goal.title}
                    </h2>
                  </div>

                  <p className="mt-1 text-xs text-muted-foreground">
                    <span className="capitalize font-medium" style={{ color: domainColor }}>
                      {goalDomain}
                    </span>{" "}
                    · {v.done}/{v.total} milestones · {items.length - milestoneItems.length} actions ·{" "}
                    <span
                      className={
                        v.onTrack ? "text-primary font-medium" : "text-warning font-medium"
                      }
                    >
                      {v.onTrack ? "On track" : "Behind pace"}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Projected finish{" "}
                    {fromISO(v.projected).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                    {v.daysAhead !== 0 && (
                      <span
                        className={
                          v.daysAhead > 0 ? "text-primary font-medium" : "text-warning font-medium"
                        }
                      >
                        {" "}
                        ({Math.abs(v.daysAhead)} days {v.daysAhead > 0 ? "early" : "late"})
                      </span>
                    )}
                  </p>
                </div>

                {/* Actions: Edit, Delete, Expand */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setEditingGoal(goal)}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
                    aria-label={`Edit goal "${goal.title}"`}
                  >
                    <Edit3 className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteGoal.mutate(goal.id)}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive cursor-pointer"
                    aria-label={`Delete goal "${goal.title}"`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : goal.id)}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
                    aria-label={isOpen ? "Collapse milestones" : "Expand milestones"}
                  >
                    <ChevronDown
                      className={cn(
                        "size-4 transition-transform duration-200",
                        isOpen && "rotate-180",
                      )}
                    />
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 space-y-2 border-t border-border pt-4">
                      {goal.description && (
                        <p className="text-xs text-muted-foreground/90 bg-muted/20 p-2.5 rounded-xl mb-3 border border-border/40">
                          {goal.description}
                        </p>
                      )}

                      {items.map((s) => {
                        const scheduledTask = tasks.find((t) => t.id === s.task_id);
                        return (
                        <div
                          key={s.id}
                          className="flex items-start gap-3 rounded-xl bg-muted/30 p-3 border border-border/40 group hover:border-primary/30 transition-colors"
                        >
                          {scheduledTask ? <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center text-primary"><CalendarPlus className="size-4" /></span> : <Button
                            variant="ghost"
                            size="icon"
                            type="button"
                            onClick={() => s.is_completed
                              ? updateSubtask.mutate({ id: s.id, patch: { is_completed: false, completed_at: null } })
                              : setConfirmingMilestone(s)}
                            aria-label={`Toggle milestone "${s.title}"`}
                            className={cn(
                              "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors cursor-pointer",
                              s.is_completed ? "border-transparent" : "border-border",
                            )}
                            style={
                              s.is_completed
                                ? { backgroundImage: "var(--gradient-aurora)" }
                                : undefined
                            }
                          >
                            {s.is_completed && (
                              <Check className="size-3 text-primary-foreground" strokeWidth={3} />
                            )}
                          </Button>}
                          <div className="min-w-0 flex-1">
                            <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">{scheduledTask ? "Scheduled action" : "Milestone · Your confirmation"}</p>
                            <p
                              className={cn(
                                "text-sm font-medium",
                                s.is_completed && "text-muted-foreground line-through",
                              )}
                            >
                              {s.title}
                            </p>
                            {s.definition_of_done && (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                Done when: {s.definition_of_done}
                              </p>
                            )}
                            {!scheduledTask && s.target_date && <p className="mt-1 text-xs text-muted-foreground">Target: {s.target_date}</p>}
                            {scheduledTask && (
                              <p className="mt-1 text-xs text-primary">
                                {cadenceLabel(scheduledTask)} · From {scheduledTask.due_date} · {scheduledTask.estimated_minutes} min
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            {scheduledTask ? (
                              <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-primary">
                                <Link to="/today"><ArrowRight className="size-3" /> Today</Link>
                              </Button>
                            ) : !s.is_completed && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleConvertToTask(goal, s)}
                                className="h-7 px-2 text-[11px] gap-1 text-primary hover:bg-primary/10"
                                title="Convert to today's task"
                              >
                                <CalendarPlus className="size-3" />
                                <span>Do Today</span>
                              </Button>
                            )}
                            <button
                              type="button"
                              onClick={() => deleteSubtask.mutate(s.id)}
                              className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                              aria-label={`Delete milestone "${s.title}"`}
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      ); })}

                      {/* Add Milestone Manually Form */}
                      {addingMilestoneGoalId === goal.id ? (
                        <div className="rounded-xl border border-primary/40 bg-surface p-3 space-y-2">
                          <Input
                            value={newMilestoneTitle}
                            onChange={(e) => setNewMilestoneTitle(e.target.value)}
                            placeholder="Milestone title (e.g. Set up auth & database schema)"
                            className="h-8 text-xs font-medium"
                            autoFocus
                          />
                          <Input
                            value={newMilestoneDod}
                            onChange={(e) => setNewMilestoneDod(e.target.value)}
                            placeholder="Definition of done (optional)"
                            className="h-8 text-xs"
                          />
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setAddingMilestoneGoalId(null)}
                              className="h-7 text-xs"
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleAddMilestone(goal.id)}
                              className="h-7 text-xs font-medium"
                              style={{ backgroundImage: "var(--gradient-aurora)" }}
                            >
                              Add Milestone
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row gap-2 pt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busyGoal !== null}
                            onClick={() => runMilestones(goal)}
                          >
                            <Sparkles className="size-4 text-accent" /> AI milestones
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => setAddingMilestoneGoalId(goal.id)}
                          >
                            <Plus className="size-4" /> Add Milestone
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            disabled={busyGoal !== null}
                            onClick={() =>
                              runBreakdown(
                                goal.id,
                                goal.title,
                                goal.description ?? "",
                                goal.target_days,
                              )
                            }
                          >
                            {busyGoal === goal.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Sparkles className="size-4 text-accent" />
                            )}
                            {items.length === 0 ? "Break down with AI" : "Add AI steps"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.article>
          );
        })}
      </div>

      <Dialog open={confirmingMilestone !== null} onOpenChange={(open) => !open && setConfirmingMilestone(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Confirm outcome</DialogTitle></DialogHeader>
          <p className="text-sm font-medium">{confirmingMilestone?.title}</p>
          <p className="text-sm text-muted-foreground">{confirmingMilestone?.definition_of_done || "Confirm that this outcome has been achieved."}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmingMilestone(null)}>Not yet</Button>
            <Button onClick={async () => {
              if (!confirmingMilestone) return;
              await updateSubtask.mutateAsync({ id: confirmingMilestone.id, patch: { is_completed: true, completed_at: new Date().toISOString() } });
              setConfirmingMilestone(null);
            }}>Confirm reached</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <EditGoalDialog
        goal={editingGoal}
        open={editingGoal !== null}
        onOpenChange={(open) => !open && setEditingGoal(null)}
        onSave={(id, patch) => {
          updateGoal.mutate({ id, patch });
          toast.success("Goal updated");
        }}
      />
    </div>
  );
}
