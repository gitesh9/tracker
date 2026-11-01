import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Download, Sprout } from "lucide-react";
import { useGoals, useSubtasks, useTasks } from "@/lib/ascend/queries";
import { todayISO } from "@/lib/ascend/cadence";
import { RangeSelector } from "@/components/ascend/RangeSelector";
import { GrowthTreeVisual } from "@/components/ascend/GrowthTreeVisual";
import { presetRange, type DateRange } from "@/lib/ascend/range";
import { SEASON_CAPACITY, seasonSummary, treeHistory, treeSummary } from "@/lib/ascend/growth-tree";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/tree")({
  head: () => ({
    meta: [
      { title: "Growth Tree — Ascend" },
      { name: "description", content: "Watch years of habits and completed tasks grow into your personal Growth Tree." },
      { property: "og:title", content: "Growth Tree — Ascend" },
      { property: "og:description", content: "Watch your consistency grow across every area of life, for years to come." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TreePage,
});

function TreePage() {
  const { data: tasks = [] } = useTasks();
  const { data: goals = [] } = useGoals();
  const { data: subtasks = [] } = useSubtasks();
  const [range, setRange] = useState<DateRange>(() => presetRange("all"));
  const canvasRef = useRef<HTMLDivElement>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const history = useMemo(() => treeHistory(tasks, range.from, range.to), [tasks, range.from, range.to]);
  const season = useMemo(() => seasonSummary(history, selectedSeason ?? history.seasonCount - 1), [history, selectedSeason]);
  const summary = useMemo(() => treeSummary(tasks, range.from, range.to), [tasks, range.from, range.to]);
  const { completions, branches, growth } = summary;
  const milestones = subtasks.filter((subtask) => subtask.is_completed).length;
  const strongest = [...branches].sort((a, b) => b.count - a.count)[0];

  const share = async () => {
    if (!canvasRef.current) return;
    try {
      const backgroundColor = getComputedStyle(document.documentElement).getPropertyValue("--background").trim();
      const url = await (await import("html-to-image")).toPng(canvasRef.current, { pixelRatio: 2, backgroundColor });
      const link = document.createElement("a");
      link.download = `ascend-growth-season-${season.index + 1}-${todayISO()}.png`;
      link.href = url;
      link.click();
      toast.success("Snapshot saved");
    } catch {
      toast.error("Couldn't export the image");
    }
  };

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-48">
          <h1 className="font-display text-2xl font-semibold">Growth Tree</h1>
          <p className="text-sm text-muted-foreground">
            {completions.toLocaleString()} completions · {milestones.toLocaleString()} milestones · {goals.length.toLocaleString()} goals
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {range.label}{strongest && strongest.count > 0 ? ` · strongest branch: ${strongest.label}` : ""}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={share}>
          <Download className="size-4" /> Share
        </Button>
      </header>
      <RangeSelector value={range} onChange={(value) => { setRange(value); setSelectedSeason(null); }} />
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-2">
          <Sprout className="size-4 text-primary" />
          <h2 className="font-display text-sm font-medium">Your grove</h2>
          <span className="text-xs text-muted-foreground">{(history.seasonCount - 1).toLocaleString()} golden trees</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Previous season" title="Previous season" disabled={season.index === 0} onClick={() => setSelectedSeason(season.index - 1)}><ChevronLeft /></Button>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">Season
            <input aria-label="Season number" type="number" min={1} max={history.seasonCount} value={season.index + 1}
              onChange={(event) => { const value = Number(event.target.value); if (Number.isFinite(value) && value >= 1) setSelectedSeason(Math.min(history.seasonCount, value) - 1); }}
              className="h-8 w-20 rounded-md border border-input bg-background px-2 text-foreground tabular-nums" />
          </label>
          <Button variant="ghost" size="icon" aria-label="Next season" title="Next season" disabled={season.index === history.seasonCount - 1} onClick={() => setSelectedSeason(season.index + 1)}><ChevronRight /></Button>
          {season.index !== history.seasonCount - 1 && <Button variant="outline" size="sm" onClick={() => setSelectedSeason(null)}>Current</Button>}
        </div>
      </div>
      <div ref={canvasRef} className="relative min-w-0 py-3" data-testid="growth-tree-snapshot"
        onTouchStart={(event) => { const touch = event.touches[0]; if (touch) swipeStart.current = { x: touch.clientX, y: touch.clientY }; }}
        onTouchEnd={(event) => {
          const touch = event.changedTouches[0]; const start = swipeStart.current; swipeStart.current = null;
          if (!touch || !start) return;
          const dx = touch.clientX - start.x;
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(touch.clientY - start.y) * 1.5) setSelectedSeason(Math.max(0, Math.min(history.seasonCount - 1, season.index + (dx < 0 ? 1 : -1))));
        }}>
        <div className="text-center">
          <p className="font-display text-lg font-semibold">Season {(season.index + 1).toLocaleString()} <span className="text-muted-foreground">·</span> <span className={season.completions === SEASON_CAPACITY ? "text-warning" : "text-primary"}>{season.stage.label}</span></p>
          <p className="mt-1 text-xs text-muted-foreground">{season.from ? `${season.from} — ${season.to}` : "A new beginning"}</p>
        </div>
        <GrowthTreeVisual key={`${range.from}-${range.to}-${season.index}`} summary={season} />
        <div className="mx-auto max-w-sm space-y-2 px-2">
          <div className="flex justify-between gap-3 text-xs tabular-nums">
            <span>{season.completions.toLocaleString()} / {SEASON_CAPACITY.toLocaleString()}</span>
            <span className="text-muted-foreground">{season.nextStage ? `${season.nextStage.label} at ${season.nextStage.at.toLocaleString()}` : "Golden tree · complete"}</span>
          </div>
          <div role="progressbar" aria-label="Season growth" aria-valuenow={season.completions} aria-valuemin={0} aria-valuemax={SEASON_CAPACITY} className="grid h-1.5 grid-cols-20 gap-0.5">
            {Array.from({ length: 20 }, (_, i) => <span key={i} className={`rounded-sm ${season.completions >= (i + 1) * 50 ? "bg-primary" : "bg-muted"}`} />)}
          </div>
          <p className="text-center text-xs text-muted-foreground">{season.completions === 1000 ? "Preserved in your grove. A new season is growing." : `${(1000 - season.completions).toLocaleString()} completions until a new season`}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <h2 className="font-medium text-foreground">Season {(season.index + 1).toLocaleString()} · life areas</h2>
        <span>{growth.rings.toLocaleString()} lifetime growth rings · next at {growth.next.toLocaleString()}</span>
      </div>
      <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
        {season.branches.map((b) => (
          <div key={b.key} className="min-w-0 rounded-lg border border-border bg-surface p-3">
            <p className="text-xs text-muted-foreground">{b.label}</p>
            <p className="break-all font-display text-xl font-semibold tabular-nums" style={{ color: b.token }} data-testid={`tree-count-${b.key}`}>
              {b.count.toLocaleString()}
            </p>
            <p className="mt-1 break-words text-xs text-muted-foreground">{(branches.find((branch) => branch.key === b.key)?.count ?? 0).toLocaleString()} total</p>
          </div>
        ))}
      </div>
    </div>
  );
}
