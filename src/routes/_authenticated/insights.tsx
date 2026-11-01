import { WeeklyRecapCard } from "@/components/ascend/WeeklyRecapCard";
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Heatmap } from "@/components/ascend/Heatmap";
import { RangeSelector } from "@/components/ascend/RangeSelector";
import { useDeferrals, useFocusSessions, useProfile, useTasks } from "@/lib/ascend/queries";
import { isCarriedForward, todayISO } from "@/lib/ascend/cadence";
import { DELAY_REASONS, DOMAINS } from "@/lib/ascend/types";
import {
  autoGranularity,
  bucketOf,
  eachDay,
  formatBucket,
  inRange,
  presetRange,
  rangeDays,
  type DateRange,
} from "@/lib/ascend/range";
import {
  diagnoseProcrastination,
  generateWeeklyRetrospective,
  type WeeklyRetrospective,
} from "@/lib/ascend/ai.functions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Calendar, Clock, Trophy, ArrowRight, Zap } from "lucide-react";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Insights — Ascend" },
      {
        name: "description",
        content:
          "Dynamic charts of consistency, focus minutes, domains and procrastination patterns.",
      },
      { property: "og:title", content: "Insights — Ascend" },
      {
        property: "og:description",
        content: "See the pattern behind your streaks and your slips.",
      },
    ],
  }),
  component: InsightsPage,
});

type MetricKey = "completions" | "focus" | "deferrals";
type ChartKind = "area" | "bar" | "line";

const METRICS: { key: MetricKey; label: string }[] = [
  { key: "completions", label: "Completions" },
  { key: "focus", label: "Focus minutes" },
  { key: "deferrals", label: "Deferrals" },
];

const CHARTS: { key: ChartKind; label: string }[] = [
  { key: "area", label: "Area" },
  { key: "bar", label: "Bars" },
  { key: "line", label: "Line" },
];

function InsightsPage() {
  const { data: tasks = [] } = useTasks();
  const { data: deferrals = [] } = useDeferrals();
  const { data: sessions = [] } = useFocusSessions();
  const { data: profile } = useProfile();

  const [range, setRange] = useState<DateRange>(() => presetRange("30d"));
  const [metric, setMetric] = useState<MetricKey>("completions");
  const [chart, setChart] = useState<ChartKind>("area");
  const [diagnosis, setDiagnosis] = useState<{ insight: string; actions: string[] } | null>(null);
  const [retrospective, setRetrospective] = useState<WeeklyRetrospective | null>(null);
  const [busy, setBusy] = useState(false);
  const [retroBusy, setRetroBusy] = useState(false);
  const diagnose = useServerFn(diagnoseProcrastination);
  const fetchRetro = useServerFn(generateWeeklyRetrospective);

  const granularity = autoGranularity(range);

  /** Per-day raw values for each metric, then bucketed for the trend chart. */
  const perDay = useMemo(() => {
    const completions: Record<string, number> = {};
    const focus: Record<string, number> = {};
    const defers: Record<string, number> = {};
    for (const task of tasks) {
      for (const d of task.completed_dates ?? []) {
        if (inRange(d, range)) completions[d] = (completions[d] ?? 0) + 1;
      }
    }
    for (const s of sessions) {
      const d = (s.started_at ?? "").slice(0, 10);
      if (inRange(d, range)) focus[d] = (focus[d] ?? 0) + Number(s.minutes ?? 0);
    }
    for (const d of deferrals) {
      const day = (d.logged_at ?? "").slice(0, 10);
      if (inRange(day, range)) defers[day] = (defers[day] ?? 0) + 1;
    }
    return { completions, focus, deferrals: defers };
  }, [tasks, sessions, deferrals, range]);

  const trend = useMemo(() => {
    const buckets = new Map<string, number>();
    for (const day of eachDay(range)) {
      const key = bucketOf(day, granularity);
      buckets.set(key, (buckets.get(key) ?? 0) + (perDay[metric][day] ?? 0));
    }
    return [...buckets.entries()].map(([key, value]) => ({
      key,
      label: formatBucket(key, granularity),
      value: Math.round(value),
    }));
  }, [range, granularity, perDay, metric]);

  const byDomain = useMemo(
    () =>
      DOMAINS.map((domain) => ({
        name: domain.label,
        token: domain.token,
        value: tasks
          .filter((t) => t.domain === domain.key)
          .reduce(
            (n, t) => n + (t.completed_dates ?? []).filter((d) => inRange(d, range)).length,
            0,
          ),
      })).filter((d) => d.value > 0),
    [tasks, range],
  );

  const byHour = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, minutes: 0 }));
    for (const s of sessions) {
      if (!inRange((s.started_at ?? "").slice(0, 10), range)) continue;
      const h = new Date(s.started_at).getHours();
      hours[h]!.minutes += Number(s.minutes ?? 0);
    }
    return hours.map((h) => ({ ...h, label: `${String(h.hour).padStart(2, "0")}` }));
  }, [sessions, range]);

  const byWeekday = useMemo(() => {
    const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const totals = names.map((name) => ({ name, value: 0 }));
    for (const [day, count] of Object.entries(perDay.completions)) {
      const index = (new Date(`${day}T00:00:00`).getDay() + 6) % 7;
      totals[index]!.value += count;
    }
    return totals;
  }, [perDay]);

  const reasonCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of deferrals) {
      if (inRange((d.logged_at ?? "").slice(0, 10), range)) {
        map[d.reason_category] = (map[d.reason_category] ?? 0) + 1;
      }
    }
    return DELAY_REASONS.map((r, i) => ({
      ...r,
      count: map[r.key] ?? 0,
      token: DOMAINS[i % 4]!.token,
    }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [deferrals, range]);

  const heatCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const task of tasks)
      for (const d of task.completed_dates ?? []) map[d] = (map[d] ?? 0) + 1;
    return map;
  }, [tasks]);

  const totals = useMemo(() => {
    const sum = (obj: Record<string, number>) => Object.values(obj).reduce((a, b) => a + b, 0);
    const activeDays = Object.keys(perDay.completions).length;
    const days = rangeDays(range);
    return {
      completions: sum(perDay.completions),
      focus: Math.round(sum(perDay.focus)),
      deferrals: sum(perDay.deferrals),
      consistency: Math.round((activeDays / days) * 100),
      perDayAvg: (sum(perDay.completions) / days).toFixed(1),
    };
  }, [perDay, range]);

  const carried = useMemo(() => tasks.filter((t) => isCarriedForward(t, todayISO())), [tasks]);

  const runDiagnosis = async () => {
    setBusy(true);
    try {
      const result = await diagnose({
        data: {
          reasons: reasonCounts.map((r) => ({ reason: r.label, count: r.count })),
          carriedTasks: carried.map((t) => t.title).slice(0, 10),
        },
      });
      setDiagnosis(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Diagnosis failed");
    } finally {
      setBusy(false);
    }
  };

  const peakHourItem = useMemo(() => {
    return [...byHour].sort((a, b) => b.minutes - a.minutes)[0];
  }, [byHour]);

  const runRetrospective = async () => {
    setRetroBusy(true);
    try {
      const result = await fetchRetro({
        data: {
          completionsCount: totals.completions,
          focusMinutes: totals.focus,
          streak: profile?.current_streak ?? 1,
          topDomains: byDomain.map((d) => d.name),
          deferralReasons: reasonCounts.map((r) => ({ reason: r.label, count: r.count })),
          peakHour: peakHourItem ? `${peakHourItem.label}:00 (${peakHourItem.minutes}m)` : "09:00",
        },
      });
      setRetrospective(result);
      toast.success("Weekly Retrospective generated!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retrospective generation failed");
    } finally {
      setRetroBusy(false);
    }
  };

  const metricLabel = METRICS.find((m) => m.key === metric)?.label ?? "Value";

  const axis = { stroke: "var(--muted-foreground)", fontSize: 11 };
  const tooltipStyle = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    fontSize: 12,
    color: "var(--foreground)",
  };

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Insights</h1>
        <p className="text-sm text-muted-foreground">
          Longest streak {profile?.longest_streak ?? 0} days · pick any window, any angle
        </p>
      </header>

      <WeeklyRecapCard tasks={tasks} />

      <RangeSelector value={range} onChange={setRange} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Completions" value={totals.completions} icon={Trophy} />
        <Stat label="Focus min" value={totals.focus} icon={Clock} />
        <Stat label="Consistency" value={`${totals.consistency}%`} icon={Calendar} />
        <Stat label="Per day" value={totals.perDayAvg} icon={Zap} />
      </div>

      <section className="glass-panel space-y-3 rounded-2xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Trend
          </h2>
          <div className="flex gap-1">
            {CHARTS.map((c) => (
              <Chip key={c.key} active={chart === c.key} onClick={() => setChart(c.key)}>
                {c.label}
              </Chip>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {METRICS.map((m) => (
            <Chip key={m.key} active={metric === m.key} onClick={() => setMetric(m.key)}>
              {m.label}
            </Chip>
          ))}
        </div>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chart === "area" ? (
              <AreaChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" {...axis} tickLine={false} minTickGap={18} />
                <YAxis {...axis} tickLine={false} allowDecimals={false} width={36} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "var(--border)" }} />
                <Area
                  type="monotone"
                  dataKey="value"
                  name={metricLabel}
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fill="url(#trendFill)"
                />
              </AreaChart>
            ) : chart === "bar" ? (
              <BarChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" {...axis} tickLine={false} minTickGap={18} />
                <YAxis {...axis} tickLine={false} allowDecimals={false} width={36} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                />
                <Bar
                  dataKey="value"
                  name={metricLabel}
                  fill="var(--accent)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            ) : (
              <LineChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" {...axis} tickLine={false} minTickGap={18} />
                <YAxis {...axis} tickLine={false} allowDecimals={false} width={36} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="value"
                  name={metricLabel}
                  stroke="var(--primary)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="glass-panel space-y-3 rounded-2xl p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            By domain
          </h2>
          {byDomain.length === 0 ? (
            <Empty>No completions in this window yet.</Empty>
          ) : (
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byDomain}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="52%"
                    outerRadius="82%"
                    paddingAngle={3}
                    stroke="none"
                  >
                    {byDomain.map((d) => (
                      <Cell key={d.name} fill={d.token} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {byDomain.map((d) => (
              <span
                key={d.name}
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <span className="size-2 rounded-full" style={{ background: d.token }} />
                {d.name} · {d.value}
              </span>
            ))}
          </div>
        </section>

        <section className="glass-panel space-y-3 rounded-2xl p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Rhythm by weekday
          </h2>
          {byWeekday.every((d) => d.value === 0) ? (
            <Empty>No completions in this window yet — your weekly rhythm will appear here.</Empty>
          ) : (
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={byWeekday} outerRadius="72%">
                  <PolarGrid stroke="var(--border)" />
                  <PolarAngleAxis
                    dataKey="name"
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  />
                  <Radar
                    dataKey="value"
                    name="Completions"
                    stroke="var(--accent)"
                    fill="var(--accent)"
                    fillOpacity={0.35}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      <section className="glass-panel space-y-3 rounded-2xl p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Focus by hour of day
        </h2>
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byHour} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" {...axis} tickLine={false} interval={2} />
              <YAxis {...axis} tickLine={false} width={36} />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: "var(--muted)", opacity: 0.3 }}
              />
              <Bar dataKey="minutes" name="Minutes" fill="var(--primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {peakHourItem && peakHourItem.minutes > 0 && (
          <p className="text-xs text-muted-foreground">
            Your prime hour is{" "}
            <span className="font-semibold text-primary">{peakHourItem.label}:00</span> —{" "}
            {Math.round(peakHourItem.minutes)} focus minutes logged there in this window. Guard it.
          </p>
        )}
      </section>

      <section className="glass-panel space-y-3 rounded-2xl p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Consistency
        </h2>
        <Heatmap counts={heatCounts} />
      </section>

      <section className="glass-panel space-y-3 rounded-2xl p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Why things slip
        </h2>
        {reasonCounts.length === 0 ? (
          <Empty>
            No deferrals in this window. When you push a task, name the reason — that's where the
            pattern lives.
          </Empty>
        ) : (
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={reasonCounts}
                  dataKey="count"
                  nameKey="label"
                  outerRadius="80%"
                  paddingAngle={2}
                  stroke="none"
                >
                  {reasonCounts.map((r) => (
                    <Cell key={r.key} fill={r.token} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {reasonCounts.map((r) => (
            <span key={r.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-2 rounded-full" style={{ background: r.token }} />
              {r.label} · {r.count}
            </span>
          ))}
        </div>

        {profile?.ai_enabled !== false && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={runDiagnosis}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4 text-accent" />
            )}
            Diagnose my pattern
          </Button>
        )}

        {diagnosis && (
          <div className="space-y-2 rounded-xl bg-muted/40 p-3">
            <p className="text-sm">{diagnosis.insight}</p>
            <ul className="space-y-1">
              {diagnosis.actions.map((a) => (
                <li key={a} className="text-xs text-muted-foreground">
                  • {a}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Weekly AI Retrospective & Smart Scheduling */}
      <section className="glass-panel space-y-4 rounded-2xl p-4 sm:p-5 w-full max-w-full overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 min-w-0">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Sparkles className="size-4 shrink-0 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wide break-words">
                Weekly AI Retrospective &amp; Smart Scheduling
              </h2>
            </div>
            <p className="text-xs text-muted-foreground break-words">
              Automated weekly recap analyzing velocity bottlenecks, peak focus hours, and timetable
              recommendations.
            </p>
          </div>
          {profile?.ai_enabled !== false && (
            <Button
              size="sm"
              onClick={runRetrospective}
              disabled={retroBusy}
              className="glow-button w-full sm:w-auto shrink-0 text-xs font-semibold text-primary-foreground"
              style={{ backgroundImage: "var(--gradient-aurora)" }}
            >
              {retroBusy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Zap className="size-3.5" />
              )}
              Generate Weekly Recap
            </Button>
          )}
        </div>

        {retrospective ? (
          <div className="space-y-4 rounded-xl border border-primary/20 bg-surface/50 p-4 w-full max-w-full overflow-hidden break-words">
            <div className="space-y-1 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                Summary
              </span>
              <p className="text-sm leading-relaxed break-words [overflow-wrap:anywhere]">
                {retrospective.summary}
              </p>
            </div>

            {retrospective.topWins.length > 0 && (
              <div className="space-y-1.5 border-t border-border/40 pt-3 min-w-0">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Trophy className="size-3.5 text-amber-400 shrink-0" /> Top Wins &amp; Highlights
                </span>
                <ul className="space-y-1 pl-1 min-w-0">
                  {retrospective.topWins.map((win, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-1.5 text-xs text-muted-foreground min-w-0 break-words [overflow-wrap:anywhere]"
                    >
                      <span className="text-primary shrink-0">•</span> <span>{win}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-1.5 border-t border-border/40 pt-3 min-w-0">
              <span className="text-xs font-semibold text-foreground">
                Procrastination &amp; Velocity Bottlenecks
              </span>
              <p className="text-xs leading-relaxed text-muted-foreground break-words [overflow-wrap:anywhere]">
                {retrospective.procrastinationAnalysis}
              </p>
            </div>

            {retrospective.scheduleAdjustments.length > 0 && (
              <div className="space-y-1.5 border-t border-border/40 pt-3 min-w-0">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Clock className="size-3.5 text-primary shrink-0" /> Recommended Timetable
                  Adjustments
                </span>
                <ul className="space-y-1 pl-1 min-w-0">
                  {retrospective.scheduleAdjustments.map((adj, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-1.5 text-xs text-muted-foreground min-w-0 break-words [overflow-wrap:anywhere]"
                    >
                      <ArrowRight className="mt-0.5 size-3 shrink-0 text-primary" />{" "}
                      <span>{adj}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {retrospective.suggestedFocusBlocks.length > 0 && (
              <div className="space-y-2 border-t border-border/40 pt-3 min-w-0">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Calendar className="size-3.5 text-primary shrink-0" /> Recommended Prime Focus
                  Blocks
                </span>
                <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 min-w-0">
                  {retrospective.suggestedFocusBlocks.map((block, i) => (
                    <div
                      key={i}
                      className="space-y-1 rounded-lg border border-border/60 bg-surface p-2.5 min-w-0 max-w-full overflow-hidden break-words"
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-primary gap-2">
                        <span className="truncate">{block.time}</span>
                        <span className="text-[10px] font-normal text-muted-foreground shrink-0">
                          Peak Block
                        </span>
                      </div>
                      <p className="text-xs font-semibold break-words [overflow-wrap:anywhere]">
                        {block.focus}
                      </p>
                      <p className="text-[11px] text-muted-foreground break-words [overflow-wrap:anywhere]">
                        {block.rationale}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground break-words">
            Click &quot;Generate Weekly Recap&quot; to synthesize your recent streak, domain
            distribution, and peak focus patterns into actionable scheduling advice.
          </div>
        )}
      </section>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-transparent bg-primary/15 text-primary"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="flex min-h-32 items-center justify-center px-3 py-6 text-center text-sm leading-relaxed text-muted-foreground">{children}</p>;
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-3 text-center transition-colors hover:border-primary/30">
      {Icon && <Icon className="mx-auto mb-1 size-3.5 text-primary/70" />}
      <p className="aurora-text font-display text-2xl font-semibold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
