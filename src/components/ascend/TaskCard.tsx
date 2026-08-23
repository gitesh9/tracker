import { useState } from "react";
import { motion } from "motion/react";
import { Check, Clock3, MoreHorizontal, Sparkles, Timer, Trash2, Zap } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { iconFor } from "@/lib/ascend/icons";
import { cadenceLabel, isCompletedOn, weekProgress } from "@/lib/ascend/cadence";
import type { Task } from "@/lib/ascend/types";
import { cn } from "@/lib/utils";
import { CelebrationBurst } from "./CelebrationBurst";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";

interface TaskCardProps {
  task: Task;
  date: string;
  carried?: boolean;
  onToggle: (task: Task, done: boolean) => void;
  onDelete: (task: Task) => void;
  onToggleAi: (task: Task, enabled: boolean) => void;
}

const DOMAIN_TOKEN: Record<string, string> = {
  focus: "var(--domain-focus)",
  health: "var(--domain-health)",
  career: "var(--domain-career)",
  mindset: "var(--domain-mindset)",
};

export function TaskCard({ task, date, carried, onToggle, onDelete, onToggleAi }: TaskCardProps) {
  const done = isCompletedOn(task, date) || task.is_completed;
  const [burst, setBurst] = useState(false);
  const Icon = iconFor(task.icon_name);
  const color = DOMAIN_TOKEN[task.domain] ?? "var(--primary)";
  const week = task.frequency_type === "weekly_count" ? weekProgress(task, date) : null;

  const handleToggle = () => {
    if (!done) {
      setBurst(true);
      window.setTimeout(() => setBurst(false), 750);
      if ("vibrate" in navigator) navigator.vibrate?.(12);
    }
    onToggle(task, !done);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border p-4 transition-colors",
        done ? "border-primary/40 bg-surface-raised" : "border-border bg-surface",
        carried && !done && "border-warning/50",
      )}
      style={{ boxShadow: done ? "var(--shadow-glow)" : "var(--shadow-soft)" }}
    >
      {carried && !done && (
        <span className="absolute right-0 top-0 rounded-bl-xl bg-warning/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-warning">
          Carried · {task.carry_forward_count}×
        </span>
      )}

      <div className="flex items-start gap-3">
        <button
          onClick={handleToggle}
          aria-label={done ? "Mark as not done" : "Mark as done"}
          className="relative shrink-0"
        >
          <CelebrationBurst active={burst} />
          <motion.span
            whileTap={{ scale: 0.86 }}
            animate={done ? { scale: [1, 1.16, 1] } : { scale: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 16 }}
            className={cn(
              "flex size-12 items-center justify-center rounded-xl border transition-all duration-300",
              done ? "border-transparent" : "border-border",
            )}
            style={{
              background: done
                ? `color-mix(in oklab, ${color} 22%, transparent)`
                : "color-mix(in oklab, var(--muted) 70%, transparent)",
              boxShadow: done ? `0 0 22px -4px color-mix(in oklab, ${color} 75%, transparent)` : "none",
            }}
          >
            <Icon
              className="size-6 transition-all duration-300"
              style={{
                color: done ? color : "var(--muted-foreground)",
                filter: done ? "saturate(1.4)" : "grayscale(1) opacity(0.75)",
              }}
            />
          </motion.span>
          {done && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full"
              style={{ background: "var(--gradient-aurora)" }}
            >
              <Check className="size-3 text-primary-foreground" strokeWidth={3} />
            </motion.span>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <button onClick={handleToggle} className="block w-full text-left">
            <p
              className={cn(
                "truncate font-medium transition-all",
                done ? "text-muted-foreground line-through" : "text-foreground",
              )}
            >
              {task.title}
            </p>
          </button>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="capitalize" style={{ color }}>
              {task.domain}
            </span>
            <span className="flex items-center gap-1">
              <Clock3 className="size-3" />
              {task.estimated_minutes}m
            </span>
            <span>{cadenceLabel(task)}</span>
            {week && (
              <span className="text-primary">
                {week.done}/{week.target} this week
              </span>
            )}
            {task.priority === "high" && (
              <span className="flex items-center gap-1 text-warning">
                <Zap className="size-3" /> High
              </span>
            )}
          </div>
          {task.definition_of_done && (
            <p className="mt-2 rounded-lg bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
              Done when: {task.definition_of_done}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Link
            to="/focus"
            search={{ task: task.id }}
            className="rounded-lg p-2 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
            aria-label="Start focus timer"
          >
            <Timer className="size-4" />
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Task options"
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="flex items-center justify-between px-2 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <Sparkles className="size-4 text-accent" /> AI for this task
                </span>
                <Switch
                  checked={task.is_ai_enabled}
                  onCheckedChange={(v) => onToggleAi(task, v)}
                  aria-label="Toggle AI for this task"
                />
              </div>
              <DropdownMenuItem onClick={() => onDelete(task)} className="text-destructive">
                <Trash2 className="size-4" /> Delete task
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </motion.div>
  );
}
