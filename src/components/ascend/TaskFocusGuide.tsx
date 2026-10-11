import { motion } from "motion/react";
import {
  Brain,
  CheckCircle2,
  Clock,
  Compass,
  Flame,
  Lightbulb,
  ListTodo,
  ShieldCheck,
  Sparkles,
  Target,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface TaskFocusGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TaskFocusGuide({ isOpen, onClose }: TaskFocusGuideProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="focus-guide-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        className="glass-panel relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border p-6 shadow-2xl space-y-6"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border/50 pb-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              <Sparkles className="size-3.5" aria-hidden="true" />
              <span>Deep Work Psychology &amp; Strategy</span>
            </div>
            <h2
              id="focus-guide-title"
              className="font-display text-xl font-bold text-foreground sm:text-2xl"
            >
              Why Link a Task to Your Focus Timer?
            </h2>
            <p className="text-xs text-muted-foreground">
              Discover how connecting concrete tasks to structured focus cycles transforms abstract
              time into relentless momentum.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close guide"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-raised hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* The 5 Superpowers */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            The 5 Superpowers of Task-Linked Focus
          </h3>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* 1. Parkinson's Law */}
            <div className="rounded-xl border border-border/70 bg-surface/60 p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-primary">
                <Target className="size-4 shrink-0" aria-hidden="true" />
                <span className="text-xs font-bold text-foreground">
                  1. Parkinson&apos;s Law Inversion
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Work expands to fill the time allotted for its completion. By binding a task to a
                25m or 50m block, you introduce a healthy artificial constraint that cuts out
                over-engineering and forces ruthless triage.
              </p>
            </div>

            {/* 2. Estimation Calibration */}
            <div className="rounded-xl border border-border/70 bg-surface/60 p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-amber-500">
                <Clock className="size-4 shrink-0" aria-hidden="true" />
                <span className="text-xs font-bold text-foreground">
                  2. Velocity &amp; Estimation Calibration
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Most humans under-estimate task duration by 40%. Ascend records your actual focus
                minutes against your estimated minutes so you train intuitive, accurate time
                perception over time.
              </p>
            </div>

            {/* 3. Definition of Done Anchor */}
            <div className="rounded-xl border border-border/70 bg-surface/60 p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-emerald-500">
                <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
                <span className="text-xs font-bold text-foreground">
                  3. Definition of Done (DoD) Anchor
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Without a clear completion finish line, focus wanders. Keeping your Definition of
                Done visible beneath the countdown acts as a lighthouse against distraction and
                scope creep.
              </p>
            </div>

            {/* 4. Single-Task Monotasking */}
            <div className="rounded-xl border border-border/70 bg-surface/60 p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-indigo-400">
                <Brain className="size-4 shrink-0" aria-hidden="true" />
                <span className="text-xs font-bold text-foreground">4. Working Memory Shield</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Context switching between tasks costs 23 minutes of refocus time. Declaring a single
                active task creates an explicit mental contract: no tab hopping, no email checks,
                only this task.
              </p>
            </div>
          </div>
        </div>

        {/* Practical Suggestions & What To Do */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            What to Do When a Task is Linked (Pro Workflow)
          </h3>

          <div className="space-y-2 text-xs">
            <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-surface/40 p-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 font-bold text-primary text-xs">
                A
              </span>
              <div>
                <strong className="text-foreground">Before Starting (Prime Focus):</strong>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  Review the Definition of Done. Use the <em>&quot;AI Sprint Strategy&quot;</em>{" "}
                  button to split large tasks into 2-3 focused sprint milestones (e.g. Block 1:
                  Discovery, Block 2: Execution, Block 3: Verification).
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-surface/40 p-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-500/15 font-bold text-amber-500 text-xs">
                B
              </span>
              <div>
                <strong className="text-foreground">
                  During the Block (Parking Lot Technique):
                </strong>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  If an intrusive thought or unrelated chore pops into your mind (&quot;Remember to
                  pay electric bill&quot;), do not switch tasks! Tap the <em>Distraction logger</em>{" "}
                  or jot it into the quick note field, then instantly return to your task.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-surface/40 p-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 font-bold text-emerald-500 text-xs">
                C
              </span>
              <div>
                <strong className="text-foreground">
                  During the Break (Cognitive Defragmentation):
                </strong>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  When the timer enters the break cycle, step away from screens. Follow
                  Ascend&apos;s restorative break suggestions (20-20-20 eye rest, hydration, light
                  stretching, or box breathing).
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-surface/40 p-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-purple-500/15 font-bold text-purple-400 text-xs">
                D
              </span>
              <div>
                <strong className="text-foreground">Upon Completion (Celebrate &amp; Log):</strong>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  When your task meets its Definition of Done, click{" "}
                  <em>&quot;Complete Task&quot;</em> directly on the Focus screen. Ascend marks it
                  done, updates your streak, and logs your deep work minutes to your daily climb!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-border/50 pt-4">
          <span className="text-[11px] text-muted-foreground">
            Tip: You can attach any daily or backlog task using the picker below the timer.
          </span>
          <Button
            size="sm"
            onClick={onClose}
            className="font-semibold text-primary-foreground aurora-gradient-bg px-6"
          >
            Got It, Let&apos;s Focus
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
