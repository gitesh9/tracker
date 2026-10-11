import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useServerFn } from "@tanstack/react-start";
import {
  Brain,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Flame,
  HelpCircle,
  Lightbulb,
  ListTodo,
  Loader2,
  Plus,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { DOMAIN_TOKEN, type Domain, type FocusSession, type Task } from "@/lib/ascend/types";
import { iconFor } from "@/lib/ascend/icons";
import { cadenceLabel } from "@/lib/ascend/cadence";
import { generateTaskFocusSprint, type TaskFocusSprintPlan } from "@/lib/ascend/ai.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CelebrationBurst } from "./CelebrationBurst";
import { cn } from "@/lib/utils";

interface LinkedTaskFocusCardProps {
  task: Task;
  sessions: FocusSession[];
  isDone: boolean;
  phase: "focus" | "break" | "longBreak";
  onToggleComplete: (task: Task, done: boolean) => void;
  onDetach: () => void;
  onOpenGuide: () => void;
}

export function LinkedTaskFocusCard({
  task,
  sessions,
  isDone,
  phase,
  onToggleComplete,
  onDetach,
  onOpenGuide,
}: LinkedTaskFocusCardProps) {
  const [showAiPlan, setShowAiPlan] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [sprintPlan, setSprintPlan] = useState<TaskFocusSprintPlan | null>(null);
  const [completedBlocks, setCompletedBlocks] = useState<number[]>([]);
  const [burst, setBurst] = useState(false);

  // Interstitial notes / parking lot thoughts
  const [noteInput, setNoteInput] = useState("");
  const [notes, setNotes] = useState<{ id: string; text: string; time: string }[]>(() => {
    try {
      const raw = localStorage.getItem(`ascend_focus_notes_${task.id}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const getSprintPlanFn = useServerFn(generateTaskFocusSprint);
  const Icon = iconFor(task.icon_name);
  const color = DOMAIN_TOKEN[task.domain as Domain] ?? "var(--primary)";

  // Calculate actual focused minutes on this task
  const taskSessions = sessions.filter((s) => s.task_id === task.id);
  const totalFocusedMinutes = taskSessions.reduce((acc, s) => acc + (s.minutes || 0), 0);
  const estMinutes = task.estimated_minutes || 25;
  const progressRatio = Math.min(2, totalFocusedMinutes / estMinutes);
  const progressPercent = Math.round((totalFocusedMinutes / estMinutes) * 100);

  const handleGenerateSprint = async () => {
    setAiLoading(true);
    setShowAiPlan(true);
    try {
      const res = await getSprintPlanFn({
        data: {
          taskTitle: task.title,
          domain: task.domain,
          estimatedMinutes: task.estimated_minutes,
          ...(task.definition_of_done ? { definitionOfDone: task.definition_of_done } : {}),
        },
      });
      setSprintPlan(res);
      toast.success("AI Focus Sprint Plan generated!");
    } catch (e) {
      toast.error("Could not generate AI plan; loaded smart deep work blueprint.");
      setSprintPlan({
        sprintGoal: `Complete primary objective for "${task.title}"`,
        blocks: [
          {
            blockNumber: 1,
            title: "Setup & High-Concentration Architecture",
            targetMinutes: 25,
            deliverable:
              "Clear initial scope, gather all materials, and execute foundational work.",
            focusTip: "Close all unneeded tabs, silence chat notifications, and single-task.",
          },
          {
            blockNumber: 2,
            title: "Core Execution & Verification",
            targetMinutes: 25,
            deliverable:
              task.definition_of_done ||
              "Complete deliverable and review against Definition of Done.",
            focusTip: "Maintain momentum; verify your finish line.",
          },
        ],
        breakSuggestion:
          "Stand up, drink a full glass of water, and rest your eyes looking into the distance.",
      });
    } finally {
      setAiLoading(false);
    }
  };

  const handleAddNote = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!noteInput.trim()) return;
    const newNote = {
      id: crypto.randomUUID(),
      text: noteInput.trim(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    const updated = [newNote, ...notes];
    setNotes(updated);
    setNoteInput("");
    try {
      localStorage.setItem(`ascend_focus_notes_${task.id}`, JSON.stringify(updated));
    } catch {
      // ignore
    }
    toast.success("Parking lot thought logged! Back to focus.");
  };

  const handleDeleteNote = (id: string) => {
    const updated = notes.filter((n) => n.id !== id);
    setNotes(updated);
    try {
      localStorage.setItem(`ascend_focus_notes_${task.id}`, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const handleToggleBlock = (blockNum: number) => {
    setCompletedBlocks((prev) =>
      prev.includes(blockNum) ? prev.filter((b) => b !== blockNum) : [...prev, blockNum],
    );
  };

  const handleCompleteTask = () => {
    if (!isDone) {
      setBurst(true);
      window.setTimeout(() => setBurst(false), 900);
      if ("vibrate" in navigator) navigator.vibrate?.([100, 50, 100]);
    }
    onToggleComplete(task, !isDone);
  };

  return (
    <div className="glass-panel relative overflow-hidden rounded-2xl border border-primary/30 bg-surface/70 p-4 sm:p-5 shadow-lg space-y-4">
      {/* Top Banner with Task Title & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-3.5">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/40 transition-transform"
            style={{
              backgroundColor: `color-mix(in oklab, ${color} 18%, transparent)`,
            }}
          >
            <Icon className="size-5" style={{ color }} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                Active Linked Task
              </span>
              <span
                className="text-[11px] font-semibold capitalize flex items-center gap-1"
                style={{ color }}
              >
                <span className="size-1.5 rounded-full" style={{ background: color }} />
                {task.domain}
              </span>
              {task.priority === "high" && (
                <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-warning">
                  <Zap className="size-3" /> High Priority
                </span>
              )}
            </div>

            <h3
              className={cn(
                "mt-1 font-display text-base sm:text-lg font-bold text-foreground truncate",
                isDone && "line-through text-muted-foreground",
              )}
            >
              {task.title}
            </h3>
          </div>
        </div>

        {/* Action buttons: Guide, Complete, Detach */}
        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onOpenGuide}
            className="h-8 px-2 text-xs text-muted-foreground hover:text-primary"
            title="Why link tasks? View tips & strategies"
          >
            <HelpCircle className="size-4 mr-1 text-primary" />
            <span className="hidden sm:inline">Why Link?</span>
          </Button>

          <div className="relative">
            <CelebrationBurst active={burst} />
            <Button
              type="button"
              size="sm"
              onClick={handleCompleteTask}
              variant={isDone ? "outline" : "default"}
              className={cn(
                "h-8 text-xs font-semibold gap-1.5 transition-all",
                isDone
                  ? "border-emerald-500/50 text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20"
                  : "text-primary-foreground shadow-md",
              )}
              style={!isDone ? { backgroundImage: "var(--gradient-aurora)" } : undefined}
            >
              <Check className="size-3.5 stroke-[3]" />
              {isDone ? "Completed" : "Complete Task"}
            </Button>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onDetach}
            aria-label="Detach task from focus timer"
            title="Detach task"
            className="size-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Progress vs Estimates Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border border-border/60 bg-surface-raised/60 p-3 text-xs">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Estimated Duration
          </span>
          <p className="font-semibold text-foreground mt-0.5 flex items-center gap-1.5">
            <Clock className="size-3.5 text-muted-foreground" />
            {estMinutes} minutes
          </p>
        </div>

        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Actual Focused Time
          </span>
          <p className="font-semibold text-primary mt-0.5 flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" />
            {totalFocusedMinutes} minutes ({taskSessions.length} sessions)
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Velocity / Calibration
            </span>
            <span
              className={cn(
                "font-bold text-[11px]",
                progressPercent > 120 ? "text-warning" : "text-emerald-500",
              )}
            >
              {progressPercent}%
            </span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                progressPercent > 120
                  ? "bg-warning"
                  : progressPercent > 80
                    ? "bg-emerald-500"
                    : "bg-primary",
              )}
              style={{ width: `${Math.min(100, progressPercent)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Definition of Done Callout */}
      {task.definition_of_done && (
        <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-3 text-xs space-y-1">
          <div className="flex items-center gap-1.5 text-primary font-bold">
            <ShieldCheck className="size-4" />
            <span>Definition of Done (Victory Condition)</span>
          </div>
          <p className="text-foreground/90 leading-relaxed pl-5 font-medium">
            {task.definition_of_done}
          </p>
        </div>
      )}

      {/* Break Time suggestions based on task domain */}
      {phase !== "focus" && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] p-3 text-xs space-y-1">
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
            <Sparkles className="size-4 animate-pulse" />
            <span>Restorative Break Suggestion for {task.domain || "Focus"}</span>
          </div>
          <p className="text-muted-foreground leading-relaxed pl-5">
            {task.domain === "career" || task.domain === "craft"
              ? "Rest your eyes (20-20-20 rule), step away from all screens, roll your shoulders, and drink a glass of cold water."
              : task.domain === "mindset" || task.domain === "wellness"
                ? "Close your eyes, practice 4 slow box breaths, and allow subconscious memory consolidation to occur."
                : "Stand up, stretch your hamstrings, shake out hand tension, and take a quick 2-minute stroll."}
          </p>
        </div>
      )}

      {/* AI Focus Sprint Strategy Section */}
      <div className="space-y-2 pt-1 border-t border-border/40">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowAiPlan(!showAiPlan)}
            className="flex items-center gap-1.5 text-xs font-bold text-foreground hover:text-primary transition-colors cursor-pointer"
          >
            <Brain className="size-4 text-accent" />
            <span>AI Sprint Milestones &amp; Coaching</span>
            {showAiPlan ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>

          {!sprintPlan && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleGenerateSprint}
              disabled={aiLoading}
              className="h-7 text-[11px] font-medium gap-1 text-accent border-accent/30 hover:bg-accent/10"
            >
              {aiLoading ? (
                <>
                  <Loader2 className="size-3 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="size-3" />
                  Breakdown Task
                </>
              )}
            </Button>
          )}
        </div>

        <AnimatePresence>
          {showAiPlan && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2.5 overflow-hidden pt-1"
            >
              {aiLoading && (
                <div className="flex items-center justify-center p-4 text-xs text-muted-foreground gap-2">
                  <Loader2 className="size-4 animate-spin text-primary" />
                  Architecting your 25m focus sprint milestones...
                </div>
              )}

              {sprintPlan && !aiLoading && (
                <div className="rounded-xl border border-border/80 bg-surface/90 p-3.5 space-y-3">
                  <div className="text-xs">
                    <strong className="text-primary font-semibold">Sprint Goal:</strong>{" "}
                    <span className="text-foreground/90">{sprintPlan.sprintGoal}</span>
                  </div>

                  <div className="space-y-2">
                    {sprintPlan.blocks.map((block) => {
                      const done = completedBlocks.includes(block.blockNumber);
                      return (
                        <div
                          key={block.blockNumber}
                          onClick={() => handleToggleBlock(block.blockNumber)}
                          className={cn(
                            "flex items-start gap-2.5 rounded-lg border p-2.5 text-xs transition-all cursor-pointer",
                            done
                              ? "border-emerald-500/40 bg-emerald-500/10 text-muted-foreground"
                              : "border-border/70 bg-surface hover:border-primary/50",
                          )}
                        >
                          <div
                            className={cn(
                              "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                              done
                                ? "border-emerald-500 bg-emerald-500 text-primary-foreground"
                                : "border-border",
                            )}
                          >
                            {done && <Check className="size-3 stroke-[3]" />}
                          </div>
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center justify-between">
                              <span
                                className={cn(
                                  "font-semibold text-foreground",
                                  done && "line-through text-muted-foreground",
                                )}
                              >
                                Block {block.blockNumber}: {block.title}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {block.targetMinutes}m
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground">{block.deliverable}</p>
                            <p className="text-[10px] text-accent/90 italic">
                              💡 Tip: {block.focusTip}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/40 pt-2">
                    <span>💡 {sprintPlan.breakSuggestion}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleGenerateSprint}
                      disabled={aiLoading}
                      className="h-6 text-[10px] px-2"
                    >
                      Regenerate
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Interstitial Notes / Parking Lot */}
      <div className="space-y-2 pt-1 border-t border-border/40">
        <form onSubmit={handleAddNote} className="flex gap-2">
          <Input
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            placeholder="Parking Lot: Quick distraction or thought to capture without breaking flow..."
            className="h-8 text-xs bg-surface/90"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!noteInput.trim()}
            variant="outline"
            className="h-8 text-xs shrink-0 font-medium"
          >
            <Plus className="size-3.5 mr-1" />
            Capture
          </Button>
        </form>

        {notes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {notes.map((n) => (
              <div
                key={n.id}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-surface/80 px-2.5 py-1 text-[11px] text-foreground"
              >
                <span className="text-[10px] text-muted-foreground font-mono">{n.time}</span>
                <span>{n.text}</span>
                <button
                  type="button"
                  onClick={() => handleDeleteNote(n.id)}
                  className="text-muted-foreground hover:text-destructive ml-1"
                  aria-label="Remove note"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
