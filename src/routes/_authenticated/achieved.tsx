import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Award, Clock, Download, Flame, Share2, Target, Trophy } from "lucide-react";
import { RangeSelector } from "@/components/ascend/RangeSelector";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ascend/EmptyState";
import {
  useAchievements,
  useFocusSessions,
  useGoals,
  useProfile,
  useSubtasks,
  useTasks,
} from "@/lib/ascend/queries";

import { BADGES } from "@/lib/ascend/badges";
import { presetRange, type DateRange } from "@/lib/ascend/range";

export const Route = createFileRoute("/_authenticated/achieved")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Achieved — Ascend" },
      {
        name: "description",
        content: "Your retrospective: milestones hit, tasks cleared and hours invested.",
      },
      { property: "og:title", content: "Achieved — Ascend" },
      { property: "og:description", content: "A shareable summary of everything you've climbed." },
    ],
  }),
  component: AchievedPage,
});

function AchievedPage() {
  const [range, setRange] = useState<DateRange>(() => presetRange("30d"));
  const { data: tasks = [] } = useTasks();
  const { data: goals = [] } = useGoals();
  const { data: subtasks = [] } = useSubtasks();
  const { data: sessions = [] } = useFocusSessions();
  const { data: achievements = [] } = useAchievements();
  const { data: profile } = useProfile();
  const cardRef = useRef<HTMLDivElement>(null);

  const from = range.from;
  const to = range.to;

  const stats = useMemo(() => {
    const completions = tasks.reduce(
      (n, t) => n + (t.completed_dates ?? []).filter((d) => d >= from && d <= to).length,
      0,
    );
    const minutes = sessions
      .filter(
        (s) => (s.started_at ?? "").slice(0, 10) >= from && (s.started_at ?? "").slice(0, 10) <= to,
      )
      .reduce((n, s) => n + Number(s.minutes ?? 0), 0);
    const subtasksDone = subtasks.filter(
      (s) =>
        s.is_completed &&
        (s.completed_at ?? "").slice(0, 10) >= from &&
        (s.completed_at ?? "").slice(0, 10) <= to,
    ).length;
    const goalsDone = goals.filter((g) => {
      const kids = subtasks.filter((s) => s.goal_id === g.id);
      return kids.length > 0 && kids.every((s) => s.is_completed);
    }).length;
    const badgesInRange = achievements.filter(
      (a) => (a.unlocked_at ?? "").slice(0, 10) >= from && (a.unlocked_at ?? "").slice(0, 10) <= to,
    );
    const activeDays = new Set(
      tasks.flatMap((t) => (t.completed_dates ?? []).filter((d) => d >= from && d <= to)),
    ).size;
    return { completions, minutes, subtasksDone, goalsDone, badgesInRange, activeDays };
  }, [tasks, sessions, subtasks, goals, achievements, from, to]);

  const label = range.label;

  const exportCard = async (share: boolean) => {
    if (!cardRef.current) return;
    try {
      const dataUrl = await (await import("html-to-image")).toPng(cardRef.current, { pixelRatio: 2, cacheBust: true });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "ascend-retrospective.png", { type: "image/png" });
      if (share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "My Ascend retrospective" });
        return;
      }
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = "ascend-retrospective.png";
      link.click();
      toast.success("Summary card saved");
    } catch {
      toast.error("Couldn't render the card");
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">Retrospective</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Achieved</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything you actually did — worth looking at more often than the to-do list.
        </p>
      </header>

      <RangeSelector value={range} onChange={setRange} />

      <motion.div
        ref={cardRef}
        key={`${range.from}-${range.to}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel space-y-5 rounded-2xl p-4 sm:p-6"
      >
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Ascend · {label}
            </p>
            <h2 className="aurora-text font-display text-xl font-semibold">
              {profile?.display_name ? `${profile.display_name}'s climb` : "Your climb"}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
            <Flame className="size-4 text-primary" />
            {profile?.current_streak ?? 0}d
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Stat icon={Trophy} value={stats.completions} label="tasks cleared" />
          <Stat icon={Clock} value={`${Math.round(stats.minutes / 60)}h`} label="focused" />
          <Stat icon={Target} value={stats.subtasksDone} label="milestones hit" />
          <Stat icon={Award} value={stats.activeDays} label="active days" />
        </div>

        {stats.badgesInRange.length > 0 && (
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
              Badges unlocked
            </p>
            <div className="flex flex-wrap gap-2">
              {stats.badgesInRange.map((a) => {
                const badge = BADGES.find((b) => b.key === a.badge_key);
                return (
                  <span
                    key={a.id}
                    className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs"
                  >
                    {badge?.label ?? a.badge_key}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {stats.completions === 0 &&
        stats.minutes === 0 &&
        stats.subtasksDone === 0 &&
        stats.goalsDone === 0 ? (
          <EmptyState icon={Trophy} title="No activity in this window" />
        ) : (
          <p className="text-xs text-muted-foreground">One small ascent every day.</p>
        )}
      </motion.div>

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => exportCard(false)}>
          <Download className="size-4" /> Save image
        </Button>
        <Button className="flex-1" onClick={() => exportCard(true)}>
          <Share2 className="size-4" /> Share
        </Button>
      </div>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Badge collection
          </h2>
          <span className="text-xs text-muted-foreground">
            {BADGES.filter((b) => achievements.some((a) => a.badge_key === b.key)).length} /{" "}
            {BADGES.length} unlocked
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {BADGES.map((badge) => {
            const owned = achievements.some((a) => a.badge_key === badge.key);
            return (
              <div
                key={badge.key}
                className={
                  owned
                    ? "glass-panel rounded-2xl p-4"
                    : "rounded-2xl border border-dashed border-border p-4 opacity-50"
                }
              >
                <Award className={owned ? "size-5 text-accent" : "size-5 text-muted-foreground"} />
                <p className="mt-2 text-sm font-medium">{badge.label}</p>
                <p className="text-xs text-muted-foreground">{badge.description}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Stat({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string | number;
  label: string;
}) {
  return (
    <div className="rounded-2xl bg-muted/40 p-4">
      <Icon className="size-4 text-primary" />
      <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
