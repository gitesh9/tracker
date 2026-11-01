import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AnimatePresence, motion } from "motion/react";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
  Bot,
  Filter,
  X,
} from "lucide-react";

import {
  useCreateTask,
  useDeleteTask,
  useGoals,
  useLogDeferral,
  useProfile,
  useTasks,
  useUpdateTask,
} from "@/lib/ascend/queries";
import {
  addDays,
  fromISO,
  isCarriedForward,
  isCompletedOn,
  isDueOn,
  todayISO,
} from "@/lib/ascend/cadence";
import { generateTimetable, type TimetableBlock } from "@/lib/ascend/ai.functions";
import type { Task } from "@/lib/ascend/types";
import { hasCategory, getAllUniqueCategories } from "@/lib/ascend/categories";
import { ProgressRing } from "@/components/ascend/ProgressRing";
import { StreakChip } from "@/components/ascend/StreakChip";
import { QuickAdd } from "@/components/ascend/QuickAdd";
import { TaskCard } from "@/components/ascend/TaskCard";
import { DelayDialog } from "@/components/ascend/DelayDialog";
import { EditTaskDialog } from "@/components/ascend/EditTaskDialog";
import { AiCoachDialog } from "@/components/ascend/AiCoachDialog";
import { WelcomeDialog } from "@/components/ascend/WelcomeDialog";
import { Button } from "@/components/ui/button";
import { localDB } from "@/lib/ascend/local-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/today")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Today — Ascend" },
      {
        name: "description",
        content: "Your daily climb: today's habits, carried tasks and focus plan.",
      },
      { property: "og:title", content: "Today — Ascend" },
      { property: "og:description", content: "Your daily climb in one calm view." },
    ],
  }),
  component: TodayPage,
});

function TodayPage() {
  const [date, setDate] = useState(todayISO());
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const { data: tasks = [], isLoading } = useTasks();
  const { data: goals = [] } = useGoals();
  const { data: profile } = useProfile();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const logDeferral = useLogDeferral();
  const [delayTask, setDelayTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [aiCoachOpen, setAiCoachOpen] = useState(false);
  const [blocks, setBlocks] = useState<TimetableBlock[] | null>(null);
  const [planning, setPlanning] = useState(false);
  const buildTimetable = useServerFn(generateTimetable);

  // Available categories on today's tasks
  const {
    availableCategories,
    rawCount,
    remainingMinutes,
    visible,
    carried,
    active,
    completed,
    ratio,
  } = useMemo(() => {
    const rawVisible = tasks.filter(
      (t) => isDueOn(t, date) || isCompletedOn(t, date) || isCarriedForward(t, date),
    );

    const categoriesInUse = getAllUniqueCategories(rawVisible).filter((cat) =>
      rawVisible.some((t) => hasCategory(t, cat.key)),
    );

    const filtered =
      selectedCategory === "all"
        ? rawVisible
        : rawVisible.filter((t) => hasCategory(t, selectedCategory));

    const car: Task[] = [];
    const act: Task[] = [];
    const comp: Task[] = [];

    for (const t of filtered) {
      if (isCompletedOn(t, date)) {
        comp.push(t);
      } else if (isCarriedForward(t, date)) {
        car.push(t);
      } else {
        act.push(t);
      }
    }

    const rat = filtered.length === 0 ? 0 : comp.length / filtered.length;
    const mins = [...car, ...act].reduce((sum, t) => sum + (t.estimated_minutes ?? 0), 0);
    return {
      availableCategories: categoriesInUse,
      rawCount: rawVisible.length,
      remainingMinutes: mins,
      visible: filtered,
      carried: car,
      active: act,
      completed: comp,
      ratio: rat,
    };
  }, [tasks, date, selectedCategory]);

  const toggle = (task: Task, done: boolean) => {
    const current = localDB.getTasks().find((item) => item.id === task.id) ?? task;
    // A second click can arrive before React replaces the card's old props.
    done = !isCompletedOn(current, date);
    const dates = new Set(current.completed_dates ?? []);
    if (done) dates.add(date);
    else dates.delete(date);
    const patch: Partial<Task> = {
      completed_dates: [...dates].sort(),
      is_completed: current.frequency_type === "once" ? done : false,
    };
    updateTask.mutate({ id: task.id, patch }, { onError: () => toast.error("Couldn't save on this device. Please try again.") });
    if (done) toast.success("Logged. Momentum kept.");
  };

  const rollForward = (task: Task, reason: string, notes: string) => {
    logDeferral.mutate({ task_id: task.id, reason_category: reason, notes });
    updateTask.mutate({
      id: task.id,
      patch: {
        due_date: addDays(date, 1),
        carry_forward_count: (task.carry_forward_count ?? 0) + 1,
      },
    });
    toast("Moved to tomorrow — reason logged.");
  };

  const plan = async () => {
    setPlanning(true);
    try {
      const result = await buildTimetable({
        data: {
          tasks: [...carried, ...active].map((t) => ({
            title: t.title,
            minutes: t.estimated_minutes,
            priority: t.priority,
            energy: t.energy_level,
          })),
          wakeTime: "07:00",
          sleepTime: "23:00",
        },
      });
      setBlocks(result.blocks);
      if (result.blocks.length === 0) toast("Nothing pending to schedule.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't build a timetable");
    } finally {
      setPlanning(false);
    }
  };

  const isToday = date === todayISO();
  const label = fromISO(date).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const shortLabel = fromISO(date).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const remainingLabel =
    visible.length === 0
      ? "Nothing scheduled yet"
      : carried.length + active.length === 0
        ? "All clear — every task logged"
        : `${carried.length + active.length} left · about ${formatMinutes(remainingMinutes)}`;

  return (
    <div className="space-y-6">
      {!isLoading && <WelcomeDialog hasTasks={tasks.some((t) => !t.id.startsWith("sample-") || (t.completed_dates ?? []).length > 0)} />}
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {isToday ? "Today" : "Reviewing"}
          </p>
          <h1 className="mt-0.5 font-display text-2xl font-semibold tracking-tight">{label}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{remainingLabel}</p>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <StreakChip
              streak={profile?.current_streak ?? 0}
              freezes={profile?.streak_freezes ?? 0}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAiCoachOpen(true)}
              className="h-7 text-xs gap-1.5 rounded-full border-primary/30 text-primary hover:bg-primary/10"
            >
              <Bot className="size-3.5" /> AI Coach
            </Button>
          </div>
        </div>
        <ProgressRing value={ratio}>
          <div className="text-center">
            <p className="font-display text-lg font-semibold">{Math.round(ratio * 100)}%</p>
            <p className="text-[10px] text-muted-foreground">
              {completed.length}/{visible.length}
            </p>
          </div>
        </ProgressRing>
      </header>

      {/* Date Navigation */}
      <div className="flex items-center gap-1 rounded-full border border-border/60 bg-surface/60 p-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-full"
          aria-label="Previous day"
          onClick={() => setDate(addDays(date, -1))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <button
          type="button"
          onClick={() => setDate(todayISO())}
          disabled={isToday}
          className={cn(
            "flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            isToday
              ? "text-muted-foreground"
              : "cursor-pointer text-primary hover:bg-primary/10 hover:text-primary",
          )}
        >
          {isToday ? shortLabel : "Jump back to today"}
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-full"
          aria-label="Next day"
          disabled={date >= todayISO()}
          onClick={() => setDate(addDays(date, 1))}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <QuickAdd
        goalOptions={goals.map((g) => ({ id: g.id, title: g.title }))}
        onAdd={(parsed, goalId) => {
          const { hints: _hints, ...rest } = parsed;
          const targetDueDate = parsed.due_date || todayISO();
          createTask.mutate({
            ...rest,
            domain: parsed.domain,
            categories: parsed.categories,
            goal_id: goalId,
            due_date: targetDueDate,
          });
          // Switch to target date if needed so task is immediately visible
          if (date !== targetDueDate) {
            setDate(targetDueDate);
          }
          // Reset category filter if selected category is not in the new task's categories
          if (selectedCategory !== "all" && !parsed.categories.includes(selectedCategory)) {
            setSelectedCategory("all");
          }
          toast.success(`“${parsed.title}” added`);
        }}
      />

      {/* Category Multi-Filter Bar */}
      {availableCategories.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <span className="text-[11px] font-semibold uppercase text-muted-foreground mr-1 flex items-center gap-1 shrink-0">
            <Filter className="size-3" /> Filter:
          </span>
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={cn(
              "rounded-full px-2.5 py-1 font-medium transition-all shrink-0 border",
              selectedCategory === "all"
                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                : "border-border/60 bg-surface/60 text-muted-foreground hover:text-foreground",
            )}
          >
            All Categories
          </button>
          {availableCategories.map((c) => {
            const isSelected = selectedCategory === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setSelectedCategory(isSelected ? "all" : c.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium transition-all shrink-0 border",
                  isSelected
                    ? "font-semibold shadow-xs"
                    : "border-border/60 bg-surface/50 text-muted-foreground hover:text-foreground",
                )}
                style={
                  isSelected
                    ? {
                        borderColor: c.color,
                        background: `color-mix(in oklab, ${c.color} 20%, transparent)`,
                        color: c.color,
                      }
                    : undefined
                }
              >
                <span className="size-1.5 rounded-full" style={{ background: c.color }} />
                <span>{c.label}</span>
              </button>
            );
          })}
          {selectedCategory !== "all" && (
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 font-medium text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
            >
              <X className="size-3" /> Clear
            </button>
          )}
        </div>
      )}

      {profile?.ai_enabled !== false && (
        <div className="glass-panel rounded-2xl p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="size-4 text-accent" /> Energy-aligned timetable
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Slot today's pending work into your natural energy curve.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={plan} disabled={planning}>
              {planning ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CalendarClock className="size-4" />
              )}
              Plan
            </Button>
          </div>
          <AnimatePresence>
            {blocks && blocks.length > 0 && (
              <motion.ul
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 space-y-2 overflow-hidden"
              >
                {blocks.map((b, i) => (
                  <li key={`${b.start}-${i}`} className="flex gap-3 rounded-xl bg-muted/40 p-3">
                    <span className="font-mono text-xs text-primary">
                      {b.start}
                      <br />
                      {b.end}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{b.title}</span>
                      <span className="block text-xs text-muted-foreground">{b.rationale}</span>
                    </span>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {carried.length > 0 && (
            <Section title="Carried forward" hint="Name the reason and it stops repeating.">
              <AnimatePresence initial={false}>
                {carried.map((task) => (
                  <div key={task.id} className="space-y-2">
                    <TaskCard
                      task={task}
                      date={date}
                      carried
                      onToggle={toggle}
                      onDelete={(t) => deleteTask.mutate(t.id)}
                      onToggleAi={(t, v) =>
                        updateTask.mutate({ id: t.id, patch: { is_ai_enabled: v } })
                      }
                      onEdit={(t) => setEditingTask(t)}
                      onCategoryClick={(catKey) => setSelectedCategory(catKey)}
                    />
                    <button
                      type="button"
                      onClick={() => setDelayTask(task)}
                      className="ml-1 inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-xs font-medium text-warning transition-colors hover:bg-warning/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning/60"
                    >
                      <CalendarClock className="size-3" /> Move to tomorrow with a reason
                    </button>
                  </div>
                ))}
              </AnimatePresence>
            </Section>
          )}

          <Section title="On deck" hint={`${active.length} left`}>
            <AnimatePresence initial={false}>
              {active.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  date={date}
                  onToggle={toggle}
                  onDelete={(t) => deleteTask.mutate(t.id)}
                  onToggleAi={(t, v) =>
                    updateTask.mutate({ id: t.id, patch: { is_ai_enabled: v } })
                  }
                  onEdit={(t) => setEditingTask(t)}
                  onCategoryClick={(catKey) => setSelectedCategory(catKey)}
                />
              ))}
            </AnimatePresence>
            {active.length === 0 && (
              <div className="flex min-h-40 flex-col items-center justify-center gap-1 py-8 text-center">
                {selectedCategory !== "all" && rawCount > 0 ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Nothing on deck in this category today.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3"
                      onClick={() => setSelectedCategory("all")}
                    >
                      Show all categories
                    </Button>
                  </>
                ) : rawCount === 0 ? (
                  <>
                    <p className="font-display text-base font-semibold">
                      {isToday ? "A clean slate." : "Nothing was planned this day."}
                    </p>
                    <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                      Add your first task above — try “read 20 pages daily” or “gym 3x per week 45
                      min”.
                    </p>
                  </>
                ) : carried.length > 0 ? (
                  <>
                    <p className="font-display text-base font-semibold">On deck is clear.</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Only the carried item{carried.length > 1 ? "s" : ""} above left — knock{" "}
                      {carried.length > 1 ? "them" : "it"} out or name the reason.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-display text-base font-semibold">Everything logged.</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Add something small, or rest — both count.
                    </p>
                  </>
                )}
              </div>
            )}
          </Section>

          {completed.length > 0 && (
            <Section title="Done" hint={`${completed.length} complete`}>
              <AnimatePresence initial={false}>
                {completed.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    date={date}
                    onToggle={toggle}
                    onDelete={(t) => deleteTask.mutate(t.id)}
                    onToggleAi={(t, v) =>
                      updateTask.mutate({ id: t.id, patch: { is_ai_enabled: v } })
                    }
                    onEdit={(t) => setEditingTask(t)}
                    onCategoryClick={(catKey) => setSelectedCategory(catKey)}
                  />
                ))}
              </AnimatePresence>
            </Section>
          )}
        </div>
      )}

      <DelayDialog
        open={delayTask !== null}
        taskTitle={delayTask?.title ?? ""}
        onOpenChange={(open) => !open && setDelayTask(null)}
        onConfirm={(reason, notes) => {
          if (delayTask) rollForward(delayTask, reason, notes);
          setDelayTask(null);
        }}
      />

      <EditTaskDialog
        task={editingTask}
        open={editingTask !== null}
        onOpenChange={(open) => !open && setEditingTask(null)}
        onSave={(id, patch) => {
          updateTask.mutate({ id, patch });
          toast.success("Task updated");
        }}
        goalOptions={goals.map((g) => ({ id: g.id, title: g.title }))}
      />

      <AiCoachDialog open={aiCoachOpen} onOpenChange={setAiCoachOpen} />
    </div>
  );
}

function formatMinutes(total: number) {
  if (total <= 0) return "0 min";
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
