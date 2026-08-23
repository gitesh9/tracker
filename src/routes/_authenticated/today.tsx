import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { CalendarClock, ChevronLeft, ChevronRight, Sparkles, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { TaskCard } from "@/components/ascend/TaskCard";
import { QuickAdd } from "@/components/ascend/QuickAdd";
import { DelayDialog } from "@/components/ascend/DelayDialog";
import { ProgressRing } from "@/components/ascend/ProgressRing";
import { StreakChip } from "@/components/ascend/StreakChip";
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
import type { Task } from "@/lib/ascend/types";
import { generateTimetable, type TimetableBlock } from "@/lib/ascend/ai.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/today")({
  head: () => ({
    meta: [
      { title: "Today — Ascend" },
      { name: "description", content: "Your daily climb: today's habits, carried tasks and focus plan." },
      { property: "og:title", content: "Today — Ascend" },
      { property: "og:description", content: "Your daily climb in one calm view." },
    ],
  }),
  component: TodayPage,
});

function TodayPage() {
  const [date, setDate] = useState(todayISO());
  const { data: tasks = [], isLoading } = useTasks();
  const { data: goals = [] } = useGoals();
  const { data: profile } = useProfile();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const logDeferral = useLogDeferral();
  const [delayTask, setDelayTask] = useState<Task | null>(null);
  const [blocks, setBlocks] = useState<TimetableBlock[] | null>(null);
  const [planning, setPlanning] = useState(false);
  const buildTimetable = useServerFn(generateTimetable);

  const visible = useMemo(
    () => tasks.filter((t) => isDueOn(t, date) || isCompletedOn(t, date) || isCarriedForward(t, date)),
    [tasks, date],
  );
  const carried = visible.filter((t) => isCarriedForward(t, date) && !isCompletedOn(t, date));
  const active = visible.filter((t) => !carried.includes(t) && !isCompletedOn(t, date));
  const completed = visible.filter((t) => isCompletedOn(t, date));
  const ratio = visible.length === 0 ? 0 : completed.length / visible.length;

  const toggle = (task: Task, done: boolean) => {
    const dates = new Set(task.completed_dates ?? []);
    if (done) dates.add(date);
    else dates.delete(date);
    const patch: Partial<Task> = {
      completed_dates: [...dates].sort(),
      is_completed: task.frequency_type === "once" ? done : false,
    };
    updateTask.mutate({ id: task.id, patch });
    if (done) toast.success("Logged. Momentum kept.");
  };

  const rollForward = (task: Task, reason: string, notes: string) => {
    logDeferral.mutate({ task_id: task.id, reason_category: reason, notes });
    updateTask.mutate({
      id: task.id,
      patch: { due_date: addDays(date, 1), carry_forward_count: (task.carry_forward_count ?? 0) + 1 },
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

  const label = fromISO(date).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{date === todayISO() ? "Today" : "Reviewing"}</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{label}</h1>
          <div className="mt-3">
            <StreakChip
              streak={profile?.current_streak ?? 0}
              freezes={profile?.streak_freezes ?? 0}
            />
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

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}>
          <ChevronLeft className="size-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setDate(todayISO())} className="flex-1">
          Jump to today
        </Button>
        <Button
          variant="ghost"
          size="icon"
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
          createTask.mutate({ ...rest, goal_id: goalId });
          toast.success(`“${parsed.title}” added`);
        }}
      />

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
              {planning ? <Loader2 className="size-4 animate-spin" /> : <CalendarClock className="size-4" />}
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
                      onToggleAi={(t, v) => updateTask.mutate({ id: t.id, patch: { is_ai_enabled: v } })}
                    />
                    <button
                      onClick={() => setDelayTask(task)}
                      className="ml-2 text-xs text-muted-foreground underline-offset-4 hover:underline"
                    >
                      Move to tomorrow with a reason
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
                  onToggleAi={(t, v) => updateTask.mutate({ id: t.id, patch: { is_ai_enabled: v } })}
                />
              ))}
            </AnimatePresence>
            {active.length === 0 && (
              <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Nothing left on deck. Add something small, or rest — both count.
              </p>
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
                    onToggleAi={(t, v) => updateTask.mutate({ id: t.id, patch: { is_ai_enabled: v } })}
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
    </div>
  );
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
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
