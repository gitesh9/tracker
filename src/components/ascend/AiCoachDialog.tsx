import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, Bot, Send, Loader2, Plus, Zap, Target, Flame, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askAscendCoach, type CoachAdviceResult } from "@/lib/ascend/ai.functions";
import { useCreateTask, useGoals, useProfile, useTasks } from "@/lib/ascend/queries";
import { DOMAIN_TOKEN, type Domain, type Task } from "@/lib/ascend/types";
import { getTaskCategories } from "@/lib/ascend/categories";

interface AiCoachDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STARTER_PROMPTS = [
  "How should I structure my day for peak deep work?",
  "I'm procrastinating on complex work — how do I break the deadlock?",
  "Suggest 3 balanced daily habits for my health and focus.",
  "How can I keep my daily streak without burning out?",
];

export function AiCoachDialog({ open, onOpenChange }: AiCoachDialogProps) {
  const { data: profile } = useProfile();
  const { data: goals = [] } = useGoals();
  const { data: tasks = [] } = useTasks();
  const createTask = useCreateTask();
  const askCoachFn = useServerFn(askAscendCoach);

  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<{ question: string; result: CoachAdviceResult }[]>([]);

  const handleAsk = async (questionText?: string) => {
    const q = (questionText ?? prompt).trim();
    if (!q || loading) return;

    setLoading(true);
    setPrompt("");

    const carriedTasks = tasks.filter((t) => (t.carry_forward_count ?? 0) > 0).map((t) => t.title);

    try {
      const result = await askCoachFn({
        data: {
          question: q,
          context: {
            currentStreak: profile?.current_streak ?? 0,
            activeGoals: goals.map((g) => g.title),
            carriedTasks: carriedTasks.slice(0, 5),
          },
        },
      });

      setHistory((prev) => [...prev, { question: q, result }]);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "AI coach request failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAddTask = (taskItem: {
    title: string;
    categories: string[];
    estimatedMinutes: number;
    frequency: string;
  }) => {
    const primaryDomain = (taskItem.categories[0] as Domain) || "focus";
    createTask.mutate({
      title: taskItem.title,
      domain: primaryDomain,
      categories: taskItem.categories,
      estimated_minutes: taskItem.estimatedMinutes || 25,
      frequency_type: taskItem.frequency === "daily" ? "daily" : "weekly_count",
      target_days_per_week: taskItem.frequency === "daily" ? 5 : 3,
      priority: "medium",
      energy_level: "high",
    });
    toast.success(`Added “${taskItem.title}” to your daily climb!`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] sm:max-w-2xl flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 sm:p-5 border-b border-border/80 bg-surface/50">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary border border-primary/30">
              <Bot className="size-5" />
            </div>
            <div>
              <DialogTitle className="font-display text-lg flex items-center gap-2">
                Ascend AI Coach <Sparkles className="size-4 text-accent" />
              </DialogTitle>
              <DialogDescription className="text-xs">
                Personalized advice, schedule optimization, and habit calibration.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 max-h-[55vh]">
          {history.length === 0 && (
            <div className="space-y-4 text-center py-4">
              <p className="text-xs text-muted-foreground">
                Ask anything about habit building, overcoming procrastination, or structuring your
                climb today.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                {STARTER_PROMPTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleAsk(p)}
                    className="rounded-xl border border-border/70 bg-surface/60 p-3 text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-muted/40 transition-all text-left group"
                  >
                    <span className="flex items-center gap-1.5 font-medium text-foreground mb-1">
                      <Zap className="size-3 text-primary" /> Prompt
                    </span>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {history.map((item, idx) => (
            <div key={idx} className="space-y-3">
              {/* User question */}
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary/20 border border-primary/30 px-3.5 py-2 text-xs sm:text-sm text-foreground">
                  {item.question}
                </div>
              </div>

              {/* Coach response */}
              <div className="flex gap-2.5 items-start">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface border border-border text-primary mt-0.5">
                  <Bot className="size-4" />
                </div>
                <div className="flex-1 space-y-3 rounded-2xl rounded-tl-sm bg-surface border border-border/80 p-3.5 text-xs sm:text-sm shadow-sm">
                  <p className="leading-relaxed whitespace-pre-line text-foreground/90">
                    {item.result.answer}
                  </p>

                  {item.result.actionItems && item.result.actionItems.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/60 space-y-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <CheckCircle2 className="size-3 text-primary" /> Recommended Actions
                      </p>
                      <ul className="space-y-1 pl-1">
                        {item.result.actionItems.map((action, aIdx) => (
                          <li
                            key={aIdx}
                            className="text-xs text-muted-foreground flex items-start gap-1.5"
                          >
                            <span className="text-primary font-bold">·</span> {action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {item.result.suggestedTasks && item.result.suggestedTasks.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/60 space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <Target className="size-3 text-accent" /> Suggested Tasks
                      </p>
                      <div className="space-y-1.5">
                        {item.result.suggestedTasks.map((st, sIdx) => (
                          <div
                            key={sIdx}
                            className="flex items-center justify-between gap-2 rounded-xl bg-muted/40 p-2 text-xs border border-border/40"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="font-medium text-foreground block truncate">
                                {st.title}
                              </span>
                              <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-muted-foreground">
                                {st.categories.map((c) => (
                                  <span key={c} className="capitalize text-primary">
                                    #{c}
                                  </span>
                                ))}
                                <span>· {st.estimatedMinutes}m</span>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleAddTask(st)}
                              className="h-7 px-2 text-xs shrink-0 flex items-center gap-1"
                            >
                              <Plus className="size-3" /> Add
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-2.5 items-start">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface border border-border text-primary animate-pulse">
                <Bot className="size-4" />
              </div>
              <div className="rounded-2xl rounded-tl-sm bg-surface border border-border/80 p-3.5 text-xs text-muted-foreground flex items-center gap-2 shadow-sm">
                <Loader2 className="size-4 animate-spin text-primary" /> Thinking through your
                climb…
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk();
          }}
          className="p-3 border-t border-border bg-surface/50 flex items-center gap-2"
        >
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask Ascend Coach for guidance, habits, or daily focus tips…"
            className="text-xs sm:text-sm bg-surface"
            disabled={loading}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!prompt.trim() || loading}
            className="shrink-0 rounded-xl"
            style={{ backgroundImage: prompt.trim() ? "var(--gradient-aurora)" : undefined }}
            aria-label="Send query to AI coach"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
