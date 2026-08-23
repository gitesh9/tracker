import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { ProgressRing } from "@/components/ascend/ProgressRing";
import { useFocusSessions, useLogFocusSession, useTasks } from "@/lib/ascend/queries";
import { isDueOn, todayISO } from "@/lib/ascend/cadence";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MODES = [
  { key: "pomodoro", label: "Pomodoro", minutes: 25 },
  { key: "deep", label: "Deep work", minutes: 50 },
  { key: "sprint", label: "Sprint", minutes: 10 },
] as const;

export const Route = createFileRoute("/_authenticated/focus")({
  validateSearch: (search: Record<string, unknown>): { task?: string } =>
    typeof search["task"] === "string" ? { task: search["task"] } : {},
  head: () => ({
    meta: [
      { title: "Focus — Ascend" },
      { name: "description", content: "Pomodoro, deep work and sprint timers with distraction logging." },
      { property: "og:title", content: "Focus — Ascend" },
      { property: "og:description", content: "Time-boxed focus sessions that get logged automatically." },
    ],
  }),
  component: FocusPage,
});

function FocusPage() {
  const { task: taskParam } = Route.useSearch();
  const { data: tasks = [] } = useTasks();
  const { data: sessions = [] } = useFocusSessions();
  const logSession = useLogFocusSession();

  const [modeKey, setModeKey] = useState<(typeof MODES)[number]["key"]>("pomodoro");
  const mode = MODES.find((m) => m.key === modeKey)!;
  const [remaining, setRemaining] = useState(mode.minutes * 60);
  const [running, setRunning] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(taskParam ?? null);
  const [distractions, setDistractions] = useState(0);
  const [muted, setMuted] = useState(false);
  const startedAt = useRef<string | null>(null);

  const todaysTasks = useMemo(
    () => tasks.filter((t) => isDueOn(t, todayISO())),
    [tasks],
  );

  useEffect(() => {
    setRemaining(mode.minutes * 60);
    setRunning(false);
  }, [mode.minutes]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          window.clearInterval(id);
          setRunning(false);
          finish();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const finish = () => {
    if (!startedAt.current) return;
    logSession.mutate({ task_id: taskId, mode: modeKey, minutes: mode.minutes, started_at: startedAt.current });
    startedAt.current = null;
    if (!muted && "vibrate" in navigator) navigator.vibrate?.([40, 60, 40]);
    toast.success(`${mode.minutes} focused minutes banked.`);
  };

  const toggle = () => {
    if (!running && !startedAt.current) startedAt.current = new Date().toISOString();
    setRunning(!running);
  };

  const reset = () => {
    setRunning(false);
    startedAt.current = null;
    setRemaining(mode.minutes * 60);
    setDistractions(0);
  };

  const total = mode.minutes * 60;
  const progress = 1 - remaining / total;
  const minutesToday = sessions
    .filter((s) => s.started_at.slice(0, 10) === todayISO())
    .reduce((sum, s) => sum + s.minutes, 0);

  return (
    <div className="space-y-7">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Focus</h1>
        <p className="text-sm text-muted-foreground">{minutesToday} minutes focused today</p>
      </header>

      <div className="glass-panel flex gap-1 rounded-full p-1">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => setModeKey(m.key)}
            className={cn(
              "relative flex-1 rounded-full px-3 py-2 text-xs font-medium transition-colors",
              m.key === modeKey ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {m.key === modeKey && (
              <motion.span
                layoutId="focus-mode"
                className="absolute inset-0 rounded-full"
                style={{ backgroundImage: "var(--gradient-aurora)" }}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <span className="relative z-10">{m.label}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col items-center gap-6 py-4">
        <motion.div animate={running ? { scale: [1, 1.015, 1] } : { scale: 1 }} transition={{ repeat: Infinity, duration: 4 }}>
          <ProgressRing value={progress} size={240} stroke={12}>
            <div className="text-center">
              <p className="font-display text-5xl font-semibold tabular-nums">
                {String(Math.floor(remaining / 60)).padStart(2, "0")}:
                {String(remaining % 60).padStart(2, "0")}
              </p>
              <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">{mode.label}</p>
            </div>
          </ProgressRing>
        </motion.div>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={reset} aria-label="Reset timer">
            <RotateCcw className="size-4" />
          </Button>
          <Button
            size="lg"
            onClick={toggle}
            className="rounded-full px-8 font-semibold"
            style={{ backgroundImage: "var(--gradient-aurora)" }}
          >
            {running ? <Pause className="size-5" /> : <Play className="size-5" />}
            {running ? "Pause" : "Start"}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setMuted(!muted)} aria-label="Toggle haptics">
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </Button>
        </div>

        <button
          onClick={() => setDistractions((d) => d + 1)}
          className="glass-panel rounded-full px-4 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Tap when distracted · {distractions}
        </button>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Attach to a task</h2>
        <div className="space-y-2">
          {todaysTasks.length === 0 && (
            <p className="text-sm text-muted-foreground">No tasks due today — focus freely.</p>
          )}
          {todaysTasks.map((t) => (
            <button
              key={t.id}
              onClick={() => setTaskId(taskId === t.id ? null : t.id)}
              className={cn(
                "w-full rounded-xl border p-3 text-left text-sm transition-colors",
                taskId === t.id ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground",
              )}
            >
              {t.title}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
