import { memo, useState } from "react";
import { motion } from "motion/react";
import {
  Check,
  ChevronDown,
  Clock3,
  Edit3,
  Link2,
  ListChecks,
  MoreHorizontal,
  Sparkles,
  Timer,
  Trash2,
  Zap,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { iconFor } from "@/lib/ascend/icons";
import { useTasks } from "@/lib/ascend/queries";
import { TaskSubtasks, useTaskSubtasks } from "./TaskSubtasks";
import { cadenceLabel, isCompletedOn, weekProgress } from "@/lib/ascend/cadence";
import { type Task } from "@/lib/ascend/types";
import { getTaskCategoryMetas, getCategoryColor } from "@/lib/ascend/categories";
import { cn } from "@/lib/utils";
import { CelebrationBurst } from "./CelebrationBurst";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  onEdit?: (task: Task) => void;
  onCategoryClick?: (categoryKey: string) => void;
}

function TaskCardComponent({
  task,
  date,
  carried,
  onToggle,
  onDelete,
  onToggleAi,
  onEdit,
  onCategoryClick,
}: TaskCardProps) {
  const done = isCompletedOn(task, date) || task.is_completed;
  const [burst, setBurst] = useState(false);
  const Icon = iconFor(task.icon_name);
  const categories = getTaskCategoryMetas(task);
  const primaryCategory = categories[0] || {
    key: "focus",
    label: "Focus",
    color: "var(--domain-focus)",
  };
  const primaryColor = primaryCategory.color;
  const week = task.frequency_type === "weekly_count" ? weekProgress(task, date) : null;
  const { done: stepsDone, total: stepsTotal } = useTaskSubtasks(task.id);
  const [showSteps, setShowSteps] = useState(false);
  const { data: allTasks = [] } = useTasks();
  const linkedTasks = (task.linked_task_ids ?? [])
    .map((id) => allTasks.find((t) => t.id === id))
    .filter((t): t is Task => Boolean(t));

  const handleToggle = (e?: React.MouseEvent) => {
    e?.stopPropagation();
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
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, pointerEvents: "none" }}
      transition={{ type: "spring", stiffness: 320, damping: 30, opacity: { type: "tween", duration: 0.08 } }}
      onClick={handleToggle}
      className={cn(
        "group relative overflow-hidden rounded-2xl border p-4 transition-all duration-200 cursor-pointer select-none",
        "hover:border-primary/70 hover:bg-surface-raised hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.995]",
        "focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/40",
        done
          ? "border-primary/40 bg-surface-raised/80 opacity-90 hover:opacity-100"
          : "border-border/80 bg-surface hover:shadow-primary/5",
        carried && !done && "border-warning/60 bg-warning/[0.03]",
      )}
      style={{ boxShadow: done ? "var(--shadow-glow)" : "var(--shadow-soft)" }}
    >
      {carried && !done && (
        <span className="absolute right-0 top-0 rounded-bl-xl bg-warning/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-warning">
          Carried · {task.carry_forward_count}×
        </span>
      )}

      <div className="flex items-start gap-3">
        {/* Toggle Checkbox Button */}
        <button
          type="button"
          onClick={handleToggle}
          aria-label={done ? `Mark "${task.title}" as uncompleted` : `Complete "${task.title}"`}
          className="relative shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
        >
          <CelebrationBurst active={burst} />
          <motion.span
            whileTap={{ scale: 0.86 }}
            whileHover={{ scale: 1.08 }}
            animate={done ? { scale: [1, 1.16, 1] } : { scale: 1 }}
            transition={{ type: "tween", duration: 0.22, ease: "easeOut" }}
            className={cn(
              "flex size-12 items-center justify-center rounded-xl border transition-all duration-300",
              done
                ? "border-transparent"
                : "border-border/80 group-hover:border-primary/60 group-hover:bg-primary/5",
            )}
            style={{
              background: done
                ? `color-mix(in oklab, ${primaryColor} 22%, transparent)`
                : "color-mix(in oklab, var(--muted) 70%, transparent)",
              boxShadow: done
                ? `0 0 22px -4px color-mix(in oklab, ${primaryColor} 75%, transparent)`
                : "none",
            }}
          >
            <Icon
              className="size-6 transition-all duration-300"
              style={{
                color: done ? primaryColor : "var(--muted-foreground)",
                filter: done ? "saturate(1.4)" : "grayscale(0.6) opacity(0.85)",
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

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="block flex-1 text-left">
              <p
                className={cn(
                  "font-medium transition-all text-sm sm:text-base group-hover:text-primary",
                  done ? "text-muted-foreground line-through" : "text-foreground",
                )}
              >
                {task.title}
              </p>
            </div>
            {onEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(task);
                }}
                aria-label={`Edit task "${task.title}"`}
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all cursor-pointer"
              >
                <Edit3 className="size-4" />
              </button>
            )}
          </div>

          {/* Multiple Category Chips */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {categories.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={(e) => {
                  if (onCategoryClick) {
                    e.stopPropagation();
                    onCategoryClick(c.key);
                  }
                }}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium transition-all border",
                  onCategoryClick ? "hover:scale-105 cursor-pointer" : "",
                )}
                style={{
                  borderColor: `color-mix(in oklab, ${c.color} 40%, transparent)`,
                  background: `color-mix(in oklab, ${c.color} 12%, transparent)`,
                  color: c.color,
                }}
              >
                <span className="size-1.5 rounded-full" style={{ background: c.color }} />
                <span>{c.label}</span>
              </button>
            ))}

            <span className="flex items-center gap-1 text-xs text-muted-foreground ml-1">
              <Clock3 className="size-3" />
              {task.estimated_minutes}m
            </span>
            <span className="text-xs text-muted-foreground">· {cadenceLabel(task)}</span>
            {week && (
              <span className="text-primary font-medium text-xs">
                · {week.done}/{week.target} this week
              </span>
            )}
            {task.priority === "high" && (
              <span className="flex items-center gap-1 text-warning font-medium text-xs ml-1">
                <Zap className="size-3" /> High
              </span>
            )}
          </div>

          {task.definition_of_done && (
            <p className="mt-2 rounded-lg bg-muted/40 px-2 py-1 text-xs text-muted-foreground border border-border/40">
              <strong className="text-foreground/80 font-medium">Done when:</strong>{" "}
              {task.definition_of_done}
            </p>
          )}

          {/* Linked tasks */}
          {linkedTasks.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Link2 className="size-3 text-muted-foreground" />
              {linkedTasks.map((lt) => (
                <span
                  key={lt.id}
                  title={`Linked to "${lt.title}"`}
                  className="max-w-[10rem] truncate rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[11px] text-muted-foreground"
                >
                  {lt.title}
                </span>
              ))}
            </div>
          )}

          {/* Subtask checklist */}
          <div className="mt-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setShowSteps((v) => !v)}
              aria-expanded={showSteps}
              className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
            >
              <ListChecks className="size-3" />
              {stepsTotal > 0 ? `Steps ${stepsDone}/${stepsTotal}` : "Add steps"}
              <ChevronDown
                className={cn("size-3 transition-transform", showSteps && "rotate-180")}
              />
            </button>
            {stepsTotal > 0 && !showSteps && (
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted/60">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.round((stepsDone / stepsTotal) * 100)}%`,
                    background: primaryColor,
                  }}
                />
              </div>
            )}
            {showSteps && (
              <div className="mt-2">
                <TaskSubtasks taskId={task.id} accentColor={primaryColor} compact />
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Link
            to="/focus"
            search={{ task: task.id }}
            className="rounded-lg p-2 text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100 hover:scale-105"
            aria-label={`Start focus timer for "${task.title}"`}
          >
            <Timer className="size-4" />
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="rounded-lg p-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary hover:scale-105"
              aria-label={`Task options for "${task.title}"`}
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(task)} className="cursor-pointer">
                  <Edit3 className="size-4 text-primary mr-2" /> Edit task details
                </DropdownMenuItem>
              )}
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
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(task)}
                className="text-destructive cursor-pointer"
              >
                <Trash2 className="size-4 mr-2" /> Delete task
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </motion.div>
  );
}

export const TaskCard = memo(TaskCardComponent);
