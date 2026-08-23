import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { toPng } from "html-to-image";
import { useGoals, useSubtasks, useTasks } from "@/lib/ascend/queries";
import { completionsInRange, todayISO, addDays } from "@/lib/ascend/cadence";
import { TimeframeSelector } from "@/components/ascend/TimeframeSelector";
import { DOMAINS, TIMEFRAMES, type TimeframeKey } from "@/lib/ascend/types";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/tree")({
  head: () => ({
    meta: [
      { title: "Growth Tree — Ascend" },
      { name: "description", content: "A living tree that grows branches and leaves as your habits compound." },
      { property: "og:title", content: "Growth Tree — Ascend" },
      { property: "og:description", content: "Watch your consistency grow into something you can see." },
    ],
  }),
  component: TreePage,
});

function TreePage() {
  const { data: tasks = [] } = useTasks();
  const { data: goals = [] } = useGoals();
  const { data: subtasks = [] } = useSubtasks();
  const [timeframe, setTimeframe] = useState<TimeframeKey>("1m");
  const canvasRef = useRef<HTMLDivElement>(null);

  const days = TIMEFRAMES.find((t) => t.key === timeframe)!.days;
  const from = addDays(todayISO(), -days + 1);
  const completions = completionsInRange(tasks, from, todayISO());
  const milestones = subtasks.filter((s) => s.is_completed).length;

  const branches = useMemo(() => {
    return DOMAINS.map((domain, i) => {
      const domainTasks = tasks.filter((t) => t.domain === domain.key);
      const count = completionsInRange(domainTasks, from, todayISO());
      return { ...domain, count, index: i };
    });
  }, [tasks, from]);

  const maxBranch = Math.max(1, ...branches.map((b) => b.count));
  const trunkHeight = Math.min(240, 90 + completions * 3);

  const share = async () => {
    if (!canvasRef.current) return;
    try {
      const url = await toPng(canvasRef.current, { pixelRatio: 2, backgroundColor: "#0B0E14" });
      const link = document.createElement("a");
      link.download = `ascend-growth-${todayISO()}.png`;
      link.href = url;
      link.click();
      toast.success("Snapshot saved");
    } catch {
      toast.error("Couldn't export the image");
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Growth Tree</h1>
          <p className="text-sm text-muted-foreground">
            {completions} completions · {milestones} milestones · {goals.length} goals
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={share}>
          <Download className="size-4" /> Share
        </Button>
      </header>

      <TimeframeSelector value={timeframe} onChange={setTimeframe} />

      <div ref={canvasRef} className="glass-panel relative overflow-hidden rounded-3xl p-6">
        <svg viewBox="0 0 320 340" className="mx-auto w-full max-w-sm" role="img" aria-label="Growth tree">
          <defs>
            <linearGradient id="trunk" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="oklch(0.42 0.05 60)" />
              <stop offset="100%" stopColor="oklch(0.55 0.06 70)" />
            </linearGradient>
          </defs>

          {/* ground glow */}
          <ellipse cx="160" cy="318" rx="90" ry="10" fill="var(--primary)" opacity="0.12" />

          {/* trunk */}
          <motion.rect
            x="150"
            width="20"
            rx="10"
            fill="url(#trunk)"
            initial={{ height: 0, y: 315 }}
            animate={{ height: trunkHeight, y: 315 - trunkHeight }}
            transition={{ type: "spring", stiffness: 60, damping: 18 }}
          />

          {branches.map((branch, i) => {
            const side = i % 2 === 0 ? -1 : 1;
            const level = Math.floor(i / 2);
            const baseY = 300 - trunkHeight * (0.35 + level * 0.28);
            const length = 30 + (branch.count / maxBranch) * 80;
            const endX = 160 + side * length;
            const endY = baseY - 34;
            const leaves = Math.min(9, Math.ceil(branch.count / 2));
            return (
              <g key={branch.key}>
                <motion.path
                  d={`M160 ${baseY} Q ${160 + side * length * 0.5} ${baseY - 12} ${endX} ${endY}`}
                  stroke="url(#trunk)"
                  strokeWidth={5}
                  strokeLinecap="round"
                  fill="none"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: branch.count > 0 ? 1 : 0.25 }}
                  transition={{ duration: 1, delay: i * 0.12 }}
                />
                {Array.from({ length: leaves }, (_, li) => {
                  const t = (li + 1) / (leaves + 1);
                  const lx = 160 + side * length * t + (li % 2 === 0 ? 8 : -8) * side;
                  const ly = baseY - 34 * t - (li % 3) * 9;
                  return (
                    <motion.circle
                      key={li}
                      cx={lx}
                      cy={ly}
                      r={5}
                      fill={branch.token}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 0.9 }}
                      transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.5 + i * 0.1 + li * 0.06 }}
                      style={{ filter: `drop-shadow(0 0 6px ${branch.token})` }}
                    />
                  );
                })}
                <text
                  x={endX + side * 12}
                  y={endY - 8}
                  textAnchor={side === -1 ? "end" : "start"}
                  fontSize="9"
                  fill="var(--muted-foreground)"
                >
                  {branch.label} · {branch.count}
                </text>
              </g>
            );
          })}
        </svg>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Every completion thickens the trunk. Every domain grows its own branch.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {branches.map((b) => (
          <div key={b.key} className="rounded-2xl border border-border bg-surface p-3">
            <p className="text-xs text-muted-foreground">{b.label}</p>
            <p className="font-display text-xl font-semibold" style={{ color: b.token }}>
              {b.count}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
