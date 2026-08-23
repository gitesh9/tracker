import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronDown, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import {
  useDeleteGoal,
  useDeleteSubtask,
  useGoals,
  useSaveGoal,
  useSaveSubtasks,
  useSubtasks,
  useUpdateSubtask,
} from "@/lib/ascend/queries";
import { goalVelocity, fromISO } from "@/lib/ascend/cadence";
import { breakdownGoal } from "@/lib/ascend/ai.functions";
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

export const Route = createFileRoute("/_authenticated/goals")({
  head: () => ({
    meta: [
      { title: "Goals — Ascend" },
      { name: "description", content: "Break long-term goals into milestones and watch your velocity." },
      { property: "og:title", content: "Goals — Ascend" },
      { property: "og:description", content: "Milestones, velocity and projected finish dates." },
    ],
  }),
  component: GoalsPage,
});

function GoalsPage() {
  const { data: goals = [] } = useGoals();
  const { data: subtasks = [] } = useSubtasks();
  const saveGoal = useSaveGoal();
  const deleteGoal = useDeleteGoal();
  const saveSubtasks = useSaveSubtasks();
  const updateSubtask = useUpdateSubtask();
  const deleteSubtask = useDeleteSubtask();
  const breakdown = useServerFn(breakdownGoal);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDays, setTargetDays] = useState(90);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busyGoal, setBusyGoal] = useState<string | null>(null);

  const create = async () => {
    if (!title.trim()) return;
    const id = await saveGoal.mutateAsync({ title: title.trim(), description, target_days: targetDays });
    setOpen(false);
    setTitle("");
    setDescription("");
    toast.success("Goal created");
    setExpanded(id);
  };

  const runBreakdown = async (goalId: string, goalTitle: string, goalDesc: string, days: number) => {
    setBusyGoal(goalId);
    try {
      const result = await breakdown({ data: { title: goalTitle, description: goalDesc, targetDays: days } });
      if (result.subtasks.length === 0) {
        toast("AI couldn't split this one — try a more specific goal.");
        return;
      }
      await saveSubtasks.mutateAsync(
        result.subtasks.map((s, i) => ({
          goal_id: goalId,
          title: s.title,
          definition_of_done: s.definition_of_done,
          estimated_minutes: s.estimated_minutes,
          position: i,
        })),
      );
      toast.success(`${result.subtasks.length} milestones added`);
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
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" style={{ backgroundImage: "var(--gradient-aurora)" }}>
              <Plus className="size-4" /> New
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New goal</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="goal-title">Goal</Label>
                <Input
                  id="goal-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Run a half marathon"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="goal-desc">Context</Label>
                <Textarea
                  id="goal-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Where you're starting from, constraints, what success looks like."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="goal-days">Target horizon (days)</Label>
                <Input
                  id="goal-days"
                  type="number"
                  min={7}
                  value={targetDays}
                  onChange={(e) => setTargetDays(Number(e.target.value))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={create} style={{ backgroundImage: "var(--gradient-aurora)" }}>
                Create goal
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      {goals.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No goals yet. Name the summit, then let it break itself into steps.
        </p>
      )}

      <div className="space-y-4">
        {goals.map((goal) => {
          const items = subtasks.filter((s) => s.goal_id === goal.id);
          const v = goalVelocity(goal, items);
          const isOpen = expanded === goal.id;
          return (
            <motion.article layout key={goal.id} className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-start gap-4">
                <ProgressRing value={v.ratio} size={64} stroke={6}>
                  <span className="font-display text-sm font-semibold">{Math.round(v.ratio * 100)}%</span>
                </ProgressRing>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-lg font-semibold leading-tight">{goal.title}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {v.done}/{v.total} milestones ·{" "}
                    <span className={v.onTrack ? "text-primary" : "text-warning"}>
                      {v.onTrack ? "On track" : "Behind pace"}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Projected finish{" "}
                    {fromISO(v.projected).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    {v.daysAhead !== 0 && (
                      <span className={v.daysAhead > 0 ? "text-primary" : "text-warning"}>
                        {" "}
                        ({Math.abs(v.daysAhead)} days {v.daysAhead > 0 ? "early" : "late"})
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <button
                    onClick={() => setExpanded(isOpen ? null : goal.id)}
                    className="rounded-lg p-2 text-muted-foreground hover:text-foreground"
                    aria-label="Toggle milestones"
                  >
                    <ChevronDown className={cn("size-4 transition-transform", isOpen && "rotate-180")} />
                  </button>
                  <button
                    onClick={() => deleteGoal.mutate(goal.id)}
                    className="rounded-lg p-2 text-muted-foreground hover:text-destructive"
                    aria-label="Delete goal"
                  >
                    <Trash2 className="size-4" />
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
                      {items.map((s) => (
                        <div key={s.id} className="flex items-start gap-3 rounded-xl bg-muted/30 p-3">
                          <button
                            onClick={() => updateSubtask.mutate({ id: s.id, patch: { is_completed: !s.is_completed } })}
                            aria-label="Toggle milestone"
                            className={cn(
                              "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                              s.is_completed ? "border-transparent" : "border-border",
                            )}
                            style={s.is_completed ? { backgroundImage: "var(--gradient-aurora)" } : undefined}
                          >
                            {s.is_completed && <Check className="size-3 text-primary-foreground" strokeWidth={3} />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className={cn("text-sm", s.is_completed && "text-muted-foreground line-through")}>
                              {s.title}
                            </p>
                            {s.definition_of_done && (
                              <p className="mt-0.5 text-xs text-muted-foreground">Done when: {s.definition_of_done}</p>
                            )}
                          </div>
                          <button
                            onClick={() => deleteSubtask.mutate(s.id)}
                            className="text-muted-foreground hover:text-destructive"
                            aria-label="Delete milestone"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        disabled={busyGoal === goal.id}
                        onClick={() =>
                          runBreakdown(goal.id, goal.title, goal.description ?? "", goal.target_days)
                        }
                      >
                        {busyGoal === goal.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Sparkles className="size-4 text-accent" />
                        )}
                        {items.length === 0 ? "Break this down with AI" : "Suggest more milestones"}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.article>
          );
        })}
      </div>
    </div>
  );
}
