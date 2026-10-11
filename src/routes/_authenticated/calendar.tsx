import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { ChevronLeft, ChevronRight, Clock, Flame, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDeferrals, useFocusSessions, useTasks } from "@/lib/ascend/queries";
import { addDays, fromISO, isDueOn, startOfWeekISO, toISO, todayISO } from "@/lib/ascend/cadence";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Calendar & Review — Ascend" },
      {
        name: "description",
        content:
          "Month view of everything you completed plus a guided weekly review of wins and slips.",
      },
      { property: "og:title", content: "Calendar & Review — Ascend" },
      {
        property: "og:description",
        content: "Zoom out on your month, then close the week properly.",
      },
    ],
  }),
  component: CalendarPage,
});

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function CalendarPage() {
  const { data: tasks = [] } = useTasks();
  const { data: sessions = [] } = useFocusSessions();
  const { data: deferrals = [] } = useDeferrals();

  const today = todayISO();
  const [monthAnchor, setMonthAnchor] = useState(() => today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const [weekOffset, setWeekOffset] = useState(0);

  const completionsByDay = useMemo(() => {
    const map: Record<string, number> = {};
    for (const task of tasks)
      for (const d of task.completed_dates ?? []) map[d] = (map[d] ?? 0) + 1;
    return map;
  }, [tasks]);

  const minutesByDay = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of sessions) {
      const d = (s.started_at ?? "").slice(0, 10);
      map[d] = (map[d] ?? 0) + Number(s.minutes ?? 0);
    }
    return map;
  }, [sessions]);

  const grid = useMemo(() => {
    const first = fromISO(`${monthAnchor}-01`);
    const leading = (first.getDay() + 6) % 7;
    const start = addDays(toISO(first), -leading);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [monthAnchor]);

  const maxCount = Math.max(1, ...grid.map((d) => completionsByDay[d] ?? 0));

  const shiftMonth = (delta: number) => {
    const date = fromISO(`${monthAnchor}-01`);
    date.setMonth(date.getMonth() + delta);
    setMonthAnchor(toISO(date).slice(0, 7));
  };

  const selectedTasks = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (t.completed_dates ?? []).includes(selected) ||
          isDueOn(t, selected) ||
          t.due_date === selected,
      ),
    [tasks, selected],
  );

  const weekStart = addDays(startOfWeekISO(today), weekOffset * 7);
  const weekEnd = addDays(weekStart, 6);
  const prevStart = addDays(weekStart, -7);

  const review = useMemo(() => {
    const sumRange = (map: Record<string, number>, from: string, to: string) =>
      Object.entries(map).reduce((n, [d, v]) => (d >= from && d <= to ? n + v : n), 0);

    const done = sumRange(completionsByDay, weekStart, weekEnd);
    const prevDone = sumRange(completionsByDay, prevStart, addDays(prevStart, 6));
    const minutes = Math.round(sumRange(minutesByDay, weekStart, weekEnd));
    const activeDays = Object.keys(completionsByDay).filter(
      (d) => d >= weekStart && d <= weekEnd,
    ).length;
    const slips = deferrals.filter((d) => {
      const day = (d.logged_at ?? "").slice(0, 10);
      return day >= weekStart && day <= weekEnd;
    });

    const wins = tasks
      .map((t) => ({
        title: t.title,
        count: (t.completed_dates ?? []).filter((d) => d >= weekStart && d <= weekEnd).length,
      }))
      .filter((t) => t.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const stalled = tasks
      .filter(
        (t) =>
          !t.is_completed &&
          isDueOn(t, weekEnd) &&
          (t.completed_dates ?? []).filter((d) => d >= weekStart && d <= weekEnd).length === 0,
      )
      .slice(0, 5);

    return { done, prevDone, minutes, activeDays, slips, wins, stalled };
  }, [completionsByDay, minutesByDay, deferrals, tasks, weekStart, weekEnd, prevStart]);

  const delta = review.done - review.prevDone;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">Zoom out</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Calendar &amp; Review
        </h1>
      </header>

      <section className="glass-panel space-y-3 rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <Button
            size="icon"
            variant="ghost"
            aria-label="Previous month"
            onClick={() => shiftMonth(-1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <p className="font-display text-sm font-semibold">
            {fromISO(`${monthAnchor}-01`).toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            })}
          </p>
          <Button size="icon" variant="ghost" aria-label="Next month" onClick={() => shiftMonth(1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>

        {monthAnchor !== today.slice(0, 7) && (
          <div className="flex justify-center">
            <button
              onClick={() => {
                setMonthAnchor(today.slice(0, 7));
                setSelected(today);
              }}
              className="rounded-full border border-border bg-surface-raised/60 px-3 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Jump back to this month
            </button>
          </div>
        )}

        <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wide text-muted-foreground">
          {WEEKDAYS.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {grid.map((day) => {
            const count = completionsByDay[day] ?? 0;
            const outside = day.slice(0, 7) !== monthAnchor;
            const isToday = day === today;
            const isSelected = day === selected;
            return (
              <button
                key={day}
                onClick={() => setSelected(day)}
                className={cn(
                  "relative flex aspect-square flex-col items-center justify-center rounded-xl border p-0.5 text-xs transition-all hover:bg-surface-raised/70",
                  isSelected ? "border-primary bg-primary/10 shadow-sm" : "border-transparent",
                  outside ? "opacity-35" : "",
                  count === 0 && !isSelected ? "bg-muted/25" : "",
                )}
                style={
                  count > 0 && !isSelected
                    ? {
                        background: `color-mix(in oklab, var(--primary) ${15 + (count / maxCount) * 45}%, transparent)`,
                      }
                    : undefined
                }
              >
                <span
                  className={cn(
                    "flex size-6 sm:size-7 items-center justify-center rounded-full text-xs transition-all",
                    isSelected
                      ? "bg-primary font-bold text-primary-foreground shadow-sm"
                      : isToday
                        ? "border border-primary text-primary font-bold"
                        : "text-foreground font-medium",
                  )}
                >
                  {Number(day.slice(8))}
                </span>
                {count > 0 && (
                  <span
                    className={cn(
                      "mt-0.5 text-[9px] font-semibold leading-none",
                      isSelected ? "text-primary font-bold" : "text-primary/90",
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-2 pt-1 text-[10px] text-muted-foreground">
          <span>Fewer</span>
          {[0, 0.25, 0.5, 0.75, 1].map((step) => (
            <span
              key={step}
              className="size-3 rounded-[4px] border border-border/60"
              style={{
                background: `color-mix(in oklab, var(--primary) ${step === 0 ? 0 : 15 + step * 45}%, transparent)`,
              }}
            />
          ))}
          <span>More</span>
        </div>
      </section>

      <motion.section
        key={selected}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel space-y-3 rounded-2xl p-4"
      >
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">
            {fromISO(selected).toLocaleDateString(undefined, {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </h2>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            {Math.round(minutesByDay[selected] ?? 0)}m focused
          </span>
        </div>
        {selectedTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing logged or scheduled on this day.</p>
        ) : (
          <ul className="space-y-1.5">
            {selectedTasks.map((t) => {
              const done = (t.completed_dates ?? []).includes(selected);
              return (
                <li
                  key={t.id}
                  className="flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2 text-sm"
                >
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      done ? "bg-primary" : "bg-muted-foreground/50",
                    )}
                  />
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate",
                      done && "text-muted-foreground line-through",
                    )}
                  >
                    {t.title}
                  </span>
                  <span className="text-[11px] capitalize text-muted-foreground">{t.domain}</span>
                </li>
              );
            })}
          </ul>
        )}
      </motion.section>

      <section className="glass-panel space-y-4 rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">
              {weekOffset === 0 ? "This week" : weekOffset === -1 ? "Last week" : "Weekly review"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {fromISO(weekStart).toLocaleDateString(undefined, { month: "short", day: "numeric" })}{" "}
              – {fromISO(weekEnd).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {weekOffset !== 0 && (
              <button
                onClick={() => setWeekOffset(0)}
                className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                This week
              </button>
            )}
            <Button
              size="icon"
              variant="ghost"
              aria-label="Previous week"
              onClick={() => setWeekOffset((w) => w - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Next week"
              disabled={weekOffset >= 0}
              onClick={() => setWeekOffset((w) => Math.min(0, w + 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Metric label="Completed" value={review.done} />
          <Metric label="Focus min" value={review.minutes} />
          <Metric label="Active days" value={review.activeDays} />
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-muted/40 p-3 text-sm">
          {delta >= 0 ? (
            <TrendingUp className="size-4 text-primary" />
          ) : (
            <TrendingDown className="size-4 text-accent" />
          )}
          <span>
            {delta === 0
              ? "Exactly level with last week."
              : `${Math.abs(delta)} ${delta > 0 ? "more" : "fewer"} completions than last week.`}
          </span>
        </div>

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
            <Flame className="size-3.5 text-primary" /> Wins
          </p>
          {review.wins.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing completed this week yet.</p>
          ) : (
            <ul className="space-y-1">
              {review.wins.map((w) => (
                <li key={w.title} className="flex justify-between text-sm">
                  <span className="min-w-0 truncate">{w.title}</span>
                  <span className="text-muted-foreground">×{w.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            Needs a decision
          </p>
          {review.stalled.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing stalled — clean week.</p>
          ) : (
            <ul className="space-y-1">
              {review.stalled.map((t) => (
                <li key={t.id} className="truncate text-sm text-muted-foreground">
                  • {t.title}
                </li>
              ))}
            </ul>
          )}
        </div>

        {review.slips.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {review.slips.length} deferral{review.slips.length === 1 ? "" : "s"} logged this week —
            check Insights for the pattern.
          </p>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-3 text-center">
      <p className="aurora-text font-display text-xl font-semibold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
