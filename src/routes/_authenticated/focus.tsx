import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {
  Brain,
  Coffee,
  HelpCircle,
  Lightbulb,
  ListTodo,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  Search,
  Settings2,
  SkipForward,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import { ProgressRing } from "@/components/ascend/ProgressRing";
import { FocusSoundPlayer } from "@/components/ascend/FocusSoundPlayer";
import { soundscapeEngine } from "@/lib/ascend/soundscapes";
import {
  useFocusSessions,
  useLogFocusSession,
  useTasks,
  useUpdateTask,
} from "@/lib/ascend/queries";
import { isDueOn, todayISO } from "@/lib/ascend/cadence";
import type { Domain, Task } from "@/lib/ascend/types";
import { DOMAIN_TOKEN } from "@/lib/ascend/types";
import { iconFor } from "@/lib/ascend/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { LinkedTaskFocusCard } from "@/components/ascend/LinkedTaskFocusCard";
import { TaskFocusGuide } from "@/components/ascend/TaskFocusGuide";
import { cn } from "@/lib/utils";

export type ModeKey = "pomodoro" | "deep" | "sprint";
export type PhaseKey = "focus" | "break" | "longBreak";

export interface TimerSettings {
  pomodoro: { label: string; focusMinutes: number; breakMinutes: number };
  deep: { label: string; focusMinutes: number; breakMinutes: number };
  sprint: { label: string; focusMinutes: number; breakMinutes: number };
  longBreakMinutes: number;
  longBreakInterval: number;
  autoLoop: boolean;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
}

const DEFAULT_CONFIGS: TimerSettings = {
  pomodoro: { label: "Pomodoro", focusMinutes: 25, breakMinutes: 5 },
  deep: { label: "Deep work", focusMinutes: 50, breakMinutes: 10 },
  sprint: { label: "Sprint", focusMinutes: 15, breakMinutes: 3 },
  longBreakMinutes: 15,
  longBreakInterval: 4,
  autoLoop: true,
  soundEnabled: true,
  hapticsEnabled: true,
};

function loadTimerConfigs(): TimerSettings {
  if (typeof window === "undefined") return DEFAULT_CONFIGS;
  try {
    const raw =
      localStorage.getItem("ascend_timer_durations_v5") ||
      localStorage.getItem("ascend_timer_durations_v4") ||
      localStorage.getItem("ascend_timer_durations_v3");
    if (!raw) return DEFAULT_CONFIGS;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return DEFAULT_CONFIGS;

    const parseMode = (m: unknown, defaultLabel: string, defFocus: number, defBreak: number) => {
      if (typeof m === "number") {
        return {
          label: defaultLabel,
          focusMinutes: m > 0 ? m : defFocus,
          breakMinutes: defBreak,
        };
      }
      if (m && typeof m === "object") {
        const obj = m as Record<string, unknown>;
        return {
          label: typeof obj["label"] === "string" ? obj["label"] : defaultLabel,
          focusMinutes:
            typeof obj["focusMinutes"] === "number" && obj["focusMinutes"] > 0
              ? obj["focusMinutes"]
              : defFocus,
          breakMinutes:
            typeof obj["breakMinutes"] === "number" && obj["breakMinutes"] > 0
              ? obj["breakMinutes"]
              : defBreak,
        };
      }
      return { label: defaultLabel, focusMinutes: defFocus, breakMinutes: defBreak };
    };

    return {
      pomodoro: parseMode(parsed.pomodoro, "Pomodoro", 25, 5),
      deep: parseMode(parsed.deep, "Deep work", 50, 10),
      sprint: parseMode(parsed.sprint, "Sprint", 15, 3),
      longBreakMinutes:
        typeof parsed.longBreakMinutes === "number" && parsed.longBreakMinutes > 0
          ? parsed.longBreakMinutes
          : 15,
      longBreakInterval:
        typeof parsed.longBreakInterval === "number" && parsed.longBreakInterval > 0
          ? parsed.longBreakInterval
          : 4,
      autoLoop: parsed.autoLoop !== undefined ? Boolean(parsed.autoLoop) : true,
      soundEnabled: parsed.soundEnabled !== undefined ? Boolean(parsed.soundEnabled) : true,
      hapticsEnabled: parsed.hapticsEnabled !== undefined ? Boolean(parsed.hapticsEnabled) : true,
    };
  } catch {
    return DEFAULT_CONFIGS;
  }
}

export const Route = createFileRoute("/_authenticated/focus")({
  validateSearch: (search: Record<string, unknown>): { task?: string } =>
    typeof search["task"] === "string" ? { task: search["task"] } : {},
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Focus & Flow — Ascend" },
      {
        name: "description",
        content:
          "Continuous Focus/Break loop timers with task velocity tracking, definition of done guardrails, and ambient soundscapes.",
      },
      { property: "og:title", content: "Focus & Flow — Ascend" },
      {
        property: "og:description",
        content: "Continuous focus loop timer linked with your tasks and deep work milestones.",
      },
    ],
  }),
  component: FocusPage,
});

function FocusPage() {
  const search = Route.useSearch();
  const taskParam = typeof search?.task === "string" ? search.task : null;

  const { data: tasks = [] } = useTasks();
  const { data: sessions = [] } = useFocusSessions();
  const logSession = useLogFocusSession();
  const updateTask = useUpdateTask();

  const [configs, setConfigs] = useState<TimerSettings>(loadTimerConfigs);
  const [modeKey, setModeKey] = useState<ModeKey>("pomodoro");
  const [phase, setPhase] = useState<PhaseKey>("focus");
  const [running, setRunning] = useState(false);
  const [distractions, setDistractions] = useState(0);
  const [cycleCount, setCycleCount] = useState(0);
  const [completedFocusBlocks, setCompletedFocusBlocks] = useState(0);
  const [muted, setMuted] = useState(false);
  const [autoPlayAudio, setAutoPlayAudio] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [taskSearch, setTaskSearch] = useState("");
  const [taskId, setTaskId] = useState<string | null>(taskParam ?? null);
  const [screenReaderAnnouncement, setScreenReaderAnnouncement] = useState("");

  const activeMode = configs?.[modeKey] ?? DEFAULT_CONFIGS[modeKey];
  const getPhaseDurationMinutes = (p: PhaseKey, m: ModeKey) => {
    const currentMode = configs?.[m] ?? DEFAULT_CONFIGS[m];
    if (p === "focus") return currentMode.focusMinutes || 25;
    if (p === "longBreak") return configs.longBreakMinutes || 15;
    return currentMode.breakMinutes || 5;
  };

  const activeDurationMinutes = getPhaseDurationMinutes(phase, modeKey);
  const [remaining, setRemaining] = useState<number>(() => (activeDurationMinutes || 25) * 60);
  const startedAt = useRef<string | null>(null);
  const toggleRunningRef = useRef<() => void>(() => {});

  const todaysTasks = useMemo(() => tasks.filter((t) => isDueOn(t, todayISO())), [tasks]);
  const attachedTask = tasks.find((t) => t.id === taskId);
  const isAttachedTaskDone = attachedTask
    ? (attachedTask.completed_dates ?? []).includes(todayISO()) || attachedTask.is_completed
    : false;

  // Filter tasks for task selector
  const selectableTasks = useMemo(() => {
    if (!taskSearch.trim()) return todaysTasks.length > 0 ? todaysTasks : tasks.slice(0, 10);
    const query = taskSearch.toLowerCase();
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(query) ||
        t.domain.toLowerCase().includes(query) ||
        (t.definition_of_done && t.definition_of_done.toLowerCase().includes(query)),
    );
  }, [tasks, todaysTasks, taskSearch]);

  // Handle browser fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Keyboard shortcut Esc for fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
        if (document.fullscreenElement) {
          void document.exitFullscreen?.().catch(() => {});
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  // Keyboard shortcut: Space toggles start/pause (ignored while typing)
  useEffect(() => {
    const handleSpace = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      toggleRunningRef.current();
    };
    window.addEventListener("keydown", handleSpace);
    return () => window.removeEventListener("keydown", handleSpace);
  }, []);

  // Phase completion handler with accessible audio, haptic, and screen reader feedback
  const handlePhaseComplete = () => {
    const isSoundActive = (configs.soundEnabled ?? true) && !muted;
    const isHapticActive = (configs.hapticsEnabled ?? true) && !muted;

    if (phase === "focus") {
      // 1. Log completed focus session
      if (startedAt.current) {
        logSession.mutate({
          task_id: taskId,
          mode: modeKey,
          minutes: configs[modeKey]?.focusMinutes || 25,
          started_at: startedAt.current,
        });
      }

      // 2. Play subtle focus completion chime
      if (isSoundActive) {
        soundscapeEngine.playFocusEndChime();
      }

      // 3. Trigger rewarding multi-pulse haptic pattern on mobile
      if (isHapticActive && typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate?.([120, 80, 120, 80, 200]);
        } catch {
          // ignore
        }
      }

      const nextBlocksCount = completedFocusBlocks + 1;
      setCompletedFocusBlocks(nextBlocksCount);

      // Check if long break interval is reached (e.g. after every 4th focus block)
      const interval = configs.longBreakInterval || 4;
      const isLongBreak = interval > 0 && nextBlocksCount % interval === 0;
      const nextPhase: PhaseKey = isLongBreak ? "longBreak" : "break";
      const nextMins = isLongBreak
        ? configs.longBreakMinutes || 15
        : configs[modeKey]?.breakMinutes || 5;

      const announceMsg = isLongBreak
        ? `Focus block #${nextBlocksCount} completed. Starting ${nextMins} minute long recharge break.`
        : `Focus block #${nextBlocksCount} completed. Starting ${nextMins} minute break.`;
      setScreenReaderAnnouncement(announceMsg);

      if (configs.autoLoop) {
        // Continuous auto loop: seamlessly start break timer
        setPhase(nextPhase);
        setRemaining(nextMins * 60);
        startedAt.current = new Date().toISOString();
        setRunning(true);
        toast.success(
          isLongBreak
            ? `🎉 Focus block #${nextBlocksCount} done! Starting ${nextMins}m long recharge break.`
            : `🎉 Focus block #${nextBlocksCount} done! Starting ${nextMins}m break.`,
        );
      } else {
        // Pauses at end of focus if autoLoop is turned off
        setPhase(nextPhase);
        setRemaining(nextMins * 60);
        setRunning(false);
        startedAt.current = null;
        toast.info(`🎉 Focus block complete! Ready for ${nextMins}m break.`);
      }
    } else {
      // Break or Long Break is finished -> Transition back to focus
      if (isSoundActive) {
        soundscapeEngine.playBreakEndChime();
      }

      if (isHapticActive && typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate?.([80, 60, 80]);
        } catch {
          // ignore
        }
      }

      setCycleCount((c) => c + 1);
      const nextMins = configs[modeKey]?.focusMinutes || 25;
      const announceMsg = `Break ended. Starting ${nextMins} minute focus session.`;
      setScreenReaderAnnouncement(announceMsg);

      if (configs.autoLoop) {
        // Continuous auto loop: seamlessly restart focus timer
        setPhase("focus");
        setRemaining(nextMins * 60);
        startedAt.current = new Date().toISOString();
        setRunning(true);
        toast.success(`⚡ Break complete! Starting ${nextMins}m Focus block.`);
      } else {
        setPhase("focus");
        setRemaining(nextMins * 60);
        setRunning(false);
        startedAt.current = null;
        toast.info(`⚡ Break complete! Ready for your next focus block.`);
      }
    }
  };

  // Core countdown ticker
  useEffect(() => {
    if (!running) return;

    const id = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          handlePhaseComplete();
          return 0;
        }
        return r - 1;
      });
    }, 1000);

    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, phase, modeKey, configs, completedFocusBlocks, taskId]);

  const handleSelectMode = (key: ModeKey) => {
    if (key === modeKey) return;
    setModeKey(key);
    setPhase("focus");
    const mins = configs[key]?.focusMinutes || 25;
    setRemaining(mins * 60);
    setRunning(false);
    startedAt.current = null;
  };

  const toggleRunning = () => {
    if (!running && !startedAt.current) {
      startedAt.current = new Date().toISOString();
    }
    const nextRunning = !running;
    setRunning(nextRunning);

    if (autoPlayAudio) {
      if (nextRunning) {
        soundscapeEngine.play();
      } else {
        soundscapeEngine.pause();
      }
    }
  };
  toggleRunningRef.current = toggleRunning;

  const resetTimer = () => {
    setRunning(false);
    startedAt.current = null;
    const mins = getPhaseDurationMinutes(phase, modeKey);
    setRemaining(mins * 60);
    setDistractions(0);
    if (autoPlayAudio) {
      soundscapeEngine.pause();
    }
  };

  const skipToNextPhase = () => {
    const isSoundActive = (configs.soundEnabled ?? true) && !muted;
    const isHapticActive = (configs.hapticsEnabled ?? true) && !muted;

    if (phase === "focus") {
      if (isSoundActive) {
        soundscapeEngine.playFocusEndChime();
      }
      if (isHapticActive && typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate?.([120, 80, 120]);
        } catch {
          // ignore
        }
      }

      const nextBlocksCount = completedFocusBlocks + 1;
      setCompletedFocusBlocks(nextBlocksCount);
      const interval = configs.longBreakInterval || 4;
      const isLongBreak = interval > 0 && nextBlocksCount % interval === 0;
      const nextPhase: PhaseKey = isLongBreak ? "longBreak" : "break";
      const nextMins = isLongBreak
        ? configs.longBreakMinutes || 15
        : configs[modeKey]?.breakMinutes || 5;

      setPhase(nextPhase);
      setRemaining(nextMins * 60);
      startedAt.current = new Date().toISOString();
      setScreenReaderAnnouncement(
        `Skipped to ${nextMins} minute ${isLongBreak ? "long " : ""}break.`,
      );
      toast.info(`Skipped to ${nextMins}m ${isLongBreak ? "long " : ""}break.`);
    } else {
      if (isSoundActive) {
        soundscapeEngine.playBreakEndChime();
      }
      if (isHapticActive && typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate?.([80, 60, 80]);
        } catch {
          // ignore
        }
      }

      setCycleCount((c) => c + 1);
      const nextMins = configs[modeKey]?.focusMinutes || 25;
      setPhase("focus");
      setRemaining(nextMins * 60);
      startedAt.current = new Date().toISOString();
      setScreenReaderAnnouncement(`Skipped to ${nextMins} minute focus session.`);
      toast.info(`Skipped to ${nextMins}m focus block.`);
    }
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      setIsFullscreen(true);
      if (document.documentElement.requestFullscreen) {
        void document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      setIsFullscreen(false);
      if (document.fullscreenElement) {
        void document.exitFullscreen?.().catch(() => {});
      }
    }
  };

  const handleSaveConfigs = (newConfigs: TimerSettings) => {
    setConfigs(newConfigs);
    try {
      localStorage.setItem("ascend_timer_durations_v5", JSON.stringify(newConfigs));
    } catch {
      // storage failsafe
    }
    const mins =
      phase === "focus"
        ? newConfigs[modeKey]?.focusMinutes || 25
        : phase === "longBreak"
          ? newConfigs.longBreakMinutes || 15
          : newConfigs[modeKey]?.breakMinutes || 5;
    setRemaining(mins * 60);
    setShowEditModal(false);
    toast.success("Timer settings, sound cues & loop preferences updated!");
  };

  const handleToggleAutoLoop = (enabled: boolean) => {
    const updated = { ...configs, autoLoop: enabled };
    setConfigs(updated);
    try {
      localStorage.setItem("ascend_timer_durations_v5", JSON.stringify(updated));
    } catch {
      // storage failsafe
    }
    toast.success(
      enabled
        ? "Continuous Auto-Loop enabled (Focus ⇄ Break will alternate automatically)"
        : "Continuous Auto-Loop paused (Timer will stop at end of each block)",
    );
  };

  const handleToggleTaskComplete = (task: Task, done: boolean) => {
    const dates = new Set(task.completed_dates ?? []);
    const date = todayISO();
    if (done) dates.add(date);
    else dates.delete(date);

    const patch: Partial<Task> = {
      completed_dates: [...dates].sort(),
      is_completed: task.frequency_type === "once" ? done : false,
    };
    updateTask.mutate({ id: task.id, patch });
    if (done) toast.success(`"${task.title}" completed! Momentum logged.`);
  };

  const total = (activeDurationMinutes || 25) * 60;
  const safeRemaining =
    typeof remaining === "number" && !Number.isNaN(remaining) ? remaining : total;
  const progress = Math.max(0, Math.min(1, 1 - safeRemaining / (total || 1)));
  const minutesToday = sessions
    .filter((s) => s.started_at.slice(0, 10) === todayISO())
    .reduce((sum, s) => sum + (s.minutes || 0), 0);

  const ringColor =
    phase === "focus"
      ? "var(--primary)"
      : phase === "longBreak"
        ? "oklch(0.72 0.18 210)"
        : "oklch(0.78 0.16 160)";

  const currentBlockInCycle = (completedFocusBlocks % (configs.longBreakInterval || 4)) + 1;

  return (
    <div className="space-y-7 max-w-5xl mx-auto">
      {/* Accessible Live Region for Screen Readers */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {screenReaderAnnouncement}
      </div>

      {/* Header with Title, Metrics & Controls */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
              Focus &amp; Flow
            </h1>
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
              Continuous Loop
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {minutesToday} minutes focused today · {completedFocusBlocks} blocks completed · Loop
            Cycle #{cycleCount + 1}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowGuideModal(true)}
            className="h-8 text-xs font-medium text-primary hover:bg-primary/10 border-primary/30"
          >
            <HelpCircle className="mr-1.5 size-3.5" />
            Why Link Tasks?
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowEditModal(true)}
            className="h-8 text-xs font-medium"
          >
            <Settings2 className="mr-1.5 size-3.5" />
            Durations &amp; Loop
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={toggleFullscreen}
            className="h-8 text-xs font-semibold"
          >
            <Maximize2 className="mr-1.5 size-3.5" />
            Fullscreen
          </Button>
        </div>
      </header>

      {/* Mode Selector Tabs */}
      <div className="glass-panel grid w-full grid-cols-3 gap-1 rounded-2xl p-1 shadow-sm border border-border/80">
        {(["pomodoro", "deep", "sprint"] as ModeKey[]).map((key) => {
          const cfg = configs[key] ?? DEFAULT_CONFIGS[key];
          const active = key === modeKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => handleSelectMode(key)}
              className={cn(
                "relative flex flex-col sm:flex-row items-center justify-center rounded-xl py-2 px-1 text-xs font-medium transition-all text-center cursor-pointer",
                active
                  ? "text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId="focus-mode"
                  className="absolute inset-0 rounded-xl"
                  style={{ backgroundImage: "var(--gradient-aurora)" }}
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <span className="relative z-10 flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5">
                <span className="truncate max-w-full font-semibold">{cfg.label}</span>
                <span className="text-[10px] opacity-85 font-normal whitespace-nowrap">
                  ({cfg.focusMinutes}m / {cfg.breakMinutes}m)
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Phase Indicator & Auto-Loop Status Banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-border/60 bg-surface/50 p-3 text-xs">
        {/* Phase Pill */}
        <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-bold transition-colors shadow-sm",
              phase === "focus"
                ? "bg-primary/15 text-primary border border-primary/30"
                : phase === "longBreak"
                  ? "bg-sky-500/15 text-sky-400 border border-sky-500/30"
                  : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
            )}
          >
            {phase === "focus" ? (
              <>
                <Sparkles className="size-3.5 text-primary animate-pulse" />
                <span>FOCUS BLOCK ({activeMode.focusMinutes}m)</span>
              </>
            ) : phase === "longBreak" ? (
              <>
                <Coffee className="size-3.5 text-sky-400 animate-pulse" />
                <span>LONG RECHARGE BREAK ({configs.longBreakMinutes}m)</span>
              </>
            ) : (
              <>
                <Coffee className="size-3.5 text-emerald-400 animate-pulse" />
                <span>RECOVERY BREAK ({activeMode.breakMinutes}m)</span>
              </>
            )}
          </div>

          {/* Block in Cycle Indicator */}
          <span className="text-muted-foreground text-[11px] font-medium">
            Block {currentBlockInCycle} of {configs.longBreakInterval || 4} before Long Break
          </span>
        </div>

        {/* Continuous Loop Toggle Switch & Skip */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-surface-raised/80 px-2.5 py-1 rounded-xl border border-border/50">
            <Repeat
              className={cn(
                "size-3.5",
                configs.autoLoop ? "text-primary animate-spin-slow" : "text-muted-foreground",
              )}
            />
            <span className="text-[11px] font-medium text-foreground">Continuous Auto-Loop</span>
            <Switch
              checked={configs.autoLoop}
              onCheckedChange={handleToggleAutoLoop}
              aria-label="Toggle continuous focus and break loop"
            />
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={skipToNextPhase}
            className="h-7 px-2.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
            title="Skip to next phase in the loop"
          >
            <SkipForward className="mr-1 size-3" />
            Skip Phase
          </Button>
        </div>
      </div>

      {/* Main Active Linked Task Banner / Card (if task attached) */}
      {attachedTask ? (
        <LinkedTaskFocusCard
          task={attachedTask}
          sessions={sessions}
          isDone={isAttachedTaskDone}
          phase={phase}
          onToggleComplete={handleToggleTaskComplete}
          onDetach={() => setTaskId(null)}
          onOpenGuide={() => setShowGuideModal(true)}
        />
      ) : (
        <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-surface/50 p-4 text-xs">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Brain className="size-4" />
            </div>
            <div>
              <p className="font-semibold text-foreground">No Task Linked · Focusing Freely</p>
              <p className="text-[11px] text-muted-foreground">
                Attaching a task enables time velocity tracking against estimates and AI sprint
                milestones.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowGuideModal(true)}
            className="h-8 text-xs font-semibold text-primary border-primary/30 hover:bg-primary/10"
          >
            <Lightbulb className="size-3.5 mr-1 text-primary" />
            Why Link?
          </Button>
        </div>
      )}

      {/* Circular Timer Display */}
      <div className="flex flex-col items-center gap-6 py-2">
        <motion.div
          animate={running ? { scale: [1, 1.012, 1] } : { scale: 1 }}
          transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut" }}
        >
          <ProgressRing value={progress} size={250} stroke={12} color={ringColor}>
            <div className="text-center px-4">
              <p className="font-display text-5xl sm:text-6xl font-bold tabular-nums tracking-tight">
                {String(Math.floor(safeRemaining / 60)).padStart(2, "0")}:
                {String(safeRemaining % 60).padStart(2, "0")}
              </p>
              <p className="mt-1 text-xs uppercase tracking-widest font-semibold text-muted-foreground">
                {phase === "focus"
                  ? activeMode.label
                  : phase === "longBreak"
                    ? "Long Recharge Break"
                    : "Break Time"}
              </p>
              {attachedTask && (
                <p className="mt-1 max-w-[170px] truncate text-[11px] font-medium text-primary">
                  {attachedTask.title}
                </p>
              )}
            </div>
          </ProgressRing>
        </motion.div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={resetTimer}
            aria-label="Reset timer"
            className="size-10 rounded-full hover:bg-surface-raised"
          >
            <RotateCcw className="size-4" />
          </Button>

          <Button
            size="lg"
            onClick={toggleRunning}
            className="rounded-full px-8 font-semibold shadow-lg text-primary-foreground transition-transform active:scale-95"
            style={{ backgroundImage: "var(--gradient-aurora)" }}
          >
            {running ? <Pause className="size-5 mr-1" /> : <Play className="size-5 mr-1" />}
            {running ? "Pause" : "Start"}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMuted(!muted)}
            aria-label="Toggle haptics and sounds"
            className="size-10 rounded-full hover:bg-surface-raised"
          >
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4 text-primary" />}
          </Button>
        </div>

        {/* Distraction logger button */}
        <button
          type="button"
          onClick={() => setDistractions((d) => d + 1)}
          className="glass-panel rounded-full px-4 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
        >
          Tap when distracted · {distractions} logged
        </button>
        <p className="hidden sm:block text-[11px] text-muted-foreground/70">
          Tip: press{" "}
          <kbd className="rounded border border-border/60 bg-surface px-1.5 py-0.5 font-mono text-[10px]">
            Space
          </kbd>{" "}
          to start or pause
        </p>
      </div>

      {/* Ambient Audio Soundscapes & Custom Music Player */}
      <section className="space-y-2">
        <FocusSoundPlayer autoPlayWithTimer={autoPlayAudio} onAutoPlayChange={setAutoPlayAudio} />
      </section>

      {/* Attach to a Task Section / Selector */}
      <section className="space-y-3 rounded-2xl border border-border/70 bg-surface/40 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <ListTodo className="size-4 text-primary" />
              <span>Link Timer to a Task</span>
            </h2>
            <p className="text-xs text-muted-foreground">
              Select a task below to focus with intention, track estimation accuracy, and unlock AI
              sprint guidance.
            </p>
          </div>

          <div className="relative w-full sm:w-60">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              value={taskSearch}
              onChange={(e) => setTaskSearch(e.target.value)}
              placeholder="Filter tasks..."
              className="h-8 pl-8 text-xs bg-surface"
            />
          </div>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {selectableTasks.length === 0 && (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No matching tasks found. Create a task in Today or Focus freely.
            </p>
          )}

          {selectableTasks.map((t) => {
            const isSelected = taskId === t.id;
            const Icon = iconFor(t.icon_name);
            const color = DOMAIN_TOKEN[t.domain as Domain] ?? "var(--primary)";
            const isDone = (t.completed_dates ?? []).includes(todayISO()) || t.is_completed;

            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTaskId(isSelected ? null : t.id)}
                className={cn(
                  "w-full rounded-xl border p-3 text-left text-xs transition-all cursor-pointer",
                  isSelected
                    ? "border-primary bg-primary/10 text-foreground font-medium shadow-sm"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40 bg-surface/70",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="flex size-7 shrink-0 items-center justify-center rounded-lg border"
                      style={{
                        backgroundColor: `color-mix(in oklab, ${color} 15%, transparent)`,
                        borderColor: `color-mix(in oklab, ${color} 40%, transparent)`,
                      }}
                    >
                      <Icon className="size-3.5" style={{ color }} />
                    </span>
                    <span
                      className={cn(
                        "font-medium text-foreground truncate",
                        isDone && "line-through text-muted-foreground",
                      )}
                    >
                      {t.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {t.estimated_minutes}m
                    </span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize"
                      style={{
                        backgroundColor: `color-mix(in oklab, ${color} 15%, transparent)`,
                        color,
                      }}
                    >
                      {t.domain}
                    </span>
                    {isSelected && (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                        Active
                      </span>
                    )}
                  </div>
                </div>
                {t.definition_of_done && (
                  <p className="mt-1 pl-9 text-[11px] text-muted-foreground truncate">
                    🎯 DoD: {t.definition_of_done}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* FULLSCREEN IMMERSIVE OVERLAY */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex flex-col justify-between overflow-y-auto bg-background/95 p-5 sm:p-8 backdrop-blur-2xl"
          >
            <div className="aurora-backdrop pointer-events-none" aria-hidden />

            {/* Top Bar */}
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  {activeMode.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  Block #{completedFocusBlocks + 1} · Loop #{cycleCount + 1}
                </span>
                {configs.autoLoop && (
                  <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                    Auto-Loop ON
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowGuideModal(true)}
                  className="h-8 text-xs"
                >
                  <HelpCircle className="mr-1.5 size-3.5 text-primary" /> Why Link?
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEditModal(true)}
                  className="h-8 text-xs"
                >
                  <Settings2 className="mr-1.5 size-3.5" /> Durations &amp; Loop
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleFullscreen}
                  className="h-8 text-xs font-semibold"
                >
                  <Minimize2 className="mr-1.5 size-3.5" /> Exit Fullscreen
                </Button>
              </div>
            </div>

            {/* Center Area: Big Ring and Controls */}
            <div className="relative z-10 my-auto flex flex-col items-center justify-center gap-6 py-6">
              {/* Phase Badge */}
              <div
                className={cn(
                  "flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold transition-colors shadow-md",
                  phase === "focus"
                    ? "bg-primary/20 text-primary border border-primary/40"
                    : phase === "longBreak"
                      ? "bg-sky-500/20 text-sky-400 border border-sky-500/40"
                      : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40",
                )}
              >
                {phase === "focus" ? (
                  <>
                    <Sparkles className="size-4 text-primary animate-pulse" />
                    <span>FOCUS BLOCK ({activeMode.focusMinutes}m)</span>
                  </>
                ) : phase === "longBreak" ? (
                  <>
                    <Coffee className="size-4 text-sky-400 animate-pulse" />
                    <span>LONG RECHARGE BREAK ({configs.longBreakMinutes}m)</span>
                  </>
                ) : (
                  <>
                    <Coffee className="size-4 text-emerald-400 animate-pulse" />
                    <span>RECOVERY BREAK ({activeMode.breakMinutes}m)</span>
                  </>
                )}
              </div>

              {/* Huge Timer Ring */}
              <motion.div
                animate={running ? { scale: [1, 1.015, 1] } : { scale: 1 }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              >
                <ProgressRing value={progress} size={280} stroke={14} color={ringColor}>
                  <div className="text-center px-4">
                    <p className="font-display text-6xl sm:text-7xl font-bold tabular-nums tracking-tight">
                      {String(Math.floor(safeRemaining / 60)).padStart(2, "0")}:
                      {String(safeRemaining % 60).padStart(2, "0")}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-widest font-semibold text-muted-foreground">
                      {phase === "focus"
                        ? "Deep Focus"
                        : phase === "longBreak"
                          ? "Long Recharge Break"
                          : "Rest & Recharge"}
                    </p>
                    {attachedTask && (
                      <p className="mt-1 max-w-[200px] truncate text-xs font-medium text-primary">
                        {attachedTask.title}
                      </p>
                    )}
                  </div>
                </ProgressRing>
              </motion.div>

              {/* Fullscreen Action Buttons */}
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={resetTimer}
                  className="size-11 rounded-full border-border/80 bg-surface/80"
                >
                  <RotateCcw className="size-4" />
                </Button>

                <Button
                  size="lg"
                  onClick={toggleRunning}
                  className="rounded-full px-10 py-6 text-base font-bold shadow-xl text-primary-foreground transition-transform active:scale-95"
                  style={{ backgroundImage: "var(--gradient-aurora)" }}
                >
                  {running ? (
                    <Pause className="size-6 mr-1.5" />
                  ) : (
                    <Play className="size-6 mr-1.5" />
                  )}
                  {running ? "Pause" : "Start"}
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={skipToNextPhase}
                  className="size-11 rounded-full border-border/80 bg-surface/80"
                  title="Skip to next phase"
                >
                  <SkipForward className="size-4" />
                </Button>
              </div>

              <button
                type="button"
                onClick={() => setDistractions((d) => d + 1)}
                className="glass-panel rounded-full px-5 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
              >
                Tap when distracted · {distractions} logged
              </button>
            </div>

            {/* Bottom Bar: Soundscape Controls in Fullscreen */}
            <div className="relative z-10 mx-auto w-full max-w-xl">
              <FocusSoundPlayer
                autoPlayWithTimer={autoPlayAudio}
                onAutoPlayChange={setAutoPlayAudio}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* EDIT DURATIONS & LOOP MODAL */}
      {showEditModal && (
        <EditTimerModal
          initialConfigs={configs}
          onSave={handleSaveConfigs}
          onClose={() => setShowEditModal(false)}
        />
      )}

      {/* TASK FOCUS STRATEGIES GUIDE MODAL */}
      <TaskFocusGuide isOpen={showGuideModal} onClose={() => setShowGuideModal(false)} />
    </div>
  );
}

function EditTimerModal({
  initialConfigs,
  onSave,
  onClose,
}: {
  initialConfigs: TimerSettings;
  onSave: (configs: TimerSettings) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(initialConfigs);

  const updateMode = (key: ModeKey, field: "focusMinutes" | "breakMinutes", val: number) => {
    const safeVal = Math.max(1, Math.min(180, Math.round(val) || 1));
    setDraft((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: safeVal,
      },
    }));
  };

  const handleResetDefaults = () => {
    setDraft(DEFAULT_CONFIGS);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-durations-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
    >
      <div className="glass-panel max-h-[90vh] overflow-y-auto w-full max-w-md rounded-2xl p-4 sm:p-5 space-y-4 border border-border shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 id="edit-durations-title" className="text-base font-semibold text-foreground">
              Customize Timer Durations &amp; Loop
            </h3>
            <p className="text-xs text-muted-foreground">
              Set focus/break intervals and continuous auto-loop behavior.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="text-muted-foreground hover:text-foreground text-sm p-1"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 text-xs pt-1">
          {/* Continuous Auto-Loop Switch */}
          <div className="flex items-center justify-between rounded-xl border border-primary/40 bg-primary/10 p-3">
            <div>
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <Repeat className="size-3.5 text-primary" /> Continuous Auto-Loop
              </span>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                When focus ends, break starts immediately. When break ends, focus restarts.
              </p>
            </div>
            <Switch
              checked={draft.autoLoop}
              onCheckedChange={(checked) => setDraft((d) => ({ ...d, autoLoop: checked }))}
              aria-label="Toggle continuous auto-loop"
            />
          </div>

          {/* Sound & Haptics Feedback Section */}
          <div className="space-y-3 rounded-xl border border-border/60 bg-surface/50 p-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <Volume2 className="size-3.5 text-primary" /> Transition Chimes &amp; Haptics
              </span>
              <span className="text-[10px] text-muted-foreground">Accessibility cues</span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-foreground">Play transition sound chime</p>
                  <p className="text-[10px] text-muted-foreground">
                    Harmonic singing bowl at focus end; gentle ascending chime at break end.
                  </p>
                </div>
                <Switch
                  checked={draft.soundEnabled}
                  onCheckedChange={(checked) => setDraft((d) => ({ ...d, soundEnabled: checked }))}
                  aria-label="Toggle transition sound chime"
                />
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-border/30">
                <div>
                  <p className="text-xs font-medium text-foreground">Haptic vibration pulse</p>
                  <p className="text-[10px] text-muted-foreground">
                    Physical pulse pattern on supported mobile and tablet devices.
                  </p>
                </div>
                <Switch
                  checked={draft.hapticsEnabled}
                  onCheckedChange={(checked) =>
                    setDraft((d) => ({ ...d, hapticsEnabled: checked }))
                  }
                  aria-label="Toggle haptic vibration feedback"
                />
              </div>

              {/* Audition / Test Buttons */}
              <div className="flex flex-wrap gap-1.5 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => soundscapeEngine.playFocusEndChime()}
                  className="h-7 text-[11px] px-2"
                >
                  <Volume2 className="size-3 mr-1 text-primary" />
                  Preview Focus Chime
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => soundscapeEngine.playBreakEndChime()}
                  className="h-7 text-[11px] px-2"
                >
                  <Volume2 className="size-3 mr-1 text-emerald-400" />
                  Preview Break Chime
                </Button>
                {typeof navigator !== "undefined" && "vibrate" in navigator && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      try {
                        navigator.vibrate?.([120, 80, 120, 80, 200]);
                        toast.success("Vibration triggered!");
                      } catch {
                        // ignore
                      }
                    }}
                    className="h-7 text-[11px] px-2"
                  >
                    <Sparkles className="size-3 mr-1 text-sky-400" />
                    Test Haptics
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Pomodoro */}
          <div className="space-y-2 rounded-xl border border-border/60 bg-surface/50 p-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground">🍅 Pomodoro Mode</span>
              <span className="text-[10px] text-muted-foreground">Default: 25m / 5m</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="pomodoro-focus" className="text-[11px]">
                  Focus (minutes)
                </Label>
                <Input
                  id="pomodoro-focus"
                  type="number"
                  min="1"
                  max="180"
                  value={draft.pomodoro.focusMinutes}
                  onChange={(e) => updateMode("pomodoro", "focusMinutes", Number(e.target.value))}
                  className="mt-1 h-8 text-xs font-semibold"
                />
              </div>
              <div>
                <Label htmlFor="pomodoro-break" className="text-[11px]">
                  Break (minutes)
                </Label>
                <Input
                  id="pomodoro-break"
                  type="number"
                  min="1"
                  max="60"
                  value={draft.pomodoro.breakMinutes}
                  onChange={(e) => updateMode("pomodoro", "breakMinutes", Number(e.target.value))}
                  className="mt-1 h-8 text-xs font-semibold"
                />
              </div>
            </div>
          </div>

          {/* Deep Work */}
          <div className="space-y-2 rounded-xl border border-border/60 bg-surface/50 p-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground">🧠 Deep Work Mode</span>
              <span className="text-[10px] text-muted-foreground">Default: 50m / 10m</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="deep-focus" className="text-[11px]">
                  Focus (minutes)
                </Label>
                <Input
                  id="deep-focus"
                  type="number"
                  min="1"
                  max="180"
                  value={draft.deep.focusMinutes}
                  onChange={(e) => updateMode("deep", "focusMinutes", Number(e.target.value))}
                  className="mt-1 h-8 text-xs font-semibold"
                />
              </div>
              <div>
                <Label htmlFor="deep-break" className="text-[11px]">
                  Break (minutes)
                </Label>
                <Input
                  id="deep-break"
                  type="number"
                  min="1"
                  max="60"
                  value={draft.deep.breakMinutes}
                  onChange={(e) => updateMode("deep", "breakMinutes", Number(e.target.value))}
                  className="mt-1 h-8 text-xs font-semibold"
                />
              </div>
            </div>
          </div>

          {/* Sprint */}
          <div className="space-y-2 rounded-xl border border-border/60 bg-surface/50 p-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground">⚡ Sprint Mode</span>
              <span className="text-[10px] text-muted-foreground">Default: 15m / 3m</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="sprint-focus" className="text-[11px]">
                  Focus (minutes)
                </Label>
                <Input
                  id="sprint-focus"
                  type="number"
                  min="1"
                  max="180"
                  value={draft.sprint.focusMinutes}
                  onChange={(e) => updateMode("sprint", "focusMinutes", Number(e.target.value))}
                  className="mt-1 h-8 text-xs font-semibold"
                />
              </div>
              <div>
                <Label htmlFor="sprint-break" className="text-[11px]">
                  Break (minutes)
                </Label>
                <Input
                  id="sprint-break"
                  type="number"
                  min="1"
                  max="60"
                  value={draft.sprint.breakMinutes}
                  onChange={(e) => updateMode("sprint", "breakMinutes", Number(e.target.value))}
                  className="mt-1 h-8 text-xs font-semibold"
                />
              </div>
            </div>
          </div>

          {/* Long Break Settings */}
          <div className="space-y-2 rounded-xl border border-border/60 bg-surface/50 p-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground">☕ Long Break Cycle</span>
              <span className="text-[10px] text-muted-foreground">Periodic restorative break</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="long-break-duration" className="text-[11px]">
                  Duration (minutes)
                </Label>
                <Input
                  id="long-break-duration"
                  type="number"
                  min="5"
                  max="60"
                  value={draft.longBreakMinutes}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      longBreakMinutes: Math.max(1, Number(e.target.value) || 15),
                    }))
                  }
                  className="mt-1 h-8 text-xs font-semibold"
                />
              </div>
              <div>
                <Label htmlFor="long-break-interval" className="text-[11px]">
                  Every N Focus Blocks
                </Label>
                <Input
                  id="long-break-interval"
                  type="number"
                  min="2"
                  max="12"
                  value={draft.longBreakInterval}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      longBreakInterval: Math.max(1, Number(e.target.value) || 4),
                    }))
                  }
                  className="mt-1 h-8 text-xs font-semibold"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border/40">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResetDefaults}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Reset Defaults
          </Button>

          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs">
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => onSave(draft)}
              style={{ backgroundImage: "var(--gradient-aurora)" }}
              className="text-xs font-semibold text-primary-foreground"
            >
              Save Settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
