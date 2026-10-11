import { useMemo, useState } from "react";
import { Check, ListChecks, Plus, Trash2 } from "lucide-react";
import {
  useDeleteSubtask,
  useSaveSubtasks,
  useSubtasks,
  useUpdateSubtask,
} from "@/lib/ascend/queries";
import type { Subtask } from "@/lib/ascend/types";
import { cn } from "@/lib/utils";

/** Steps that belong to a single task, ordered and counted. Shared by the card and the
 *  edit dialog so both always agree on progress. */
export function useTaskSubtasks(taskId: string | null | undefined) {
  const { data: all = [] } = useSubtasks();
  return useMemo(() => {
    const items: Subtask[] = taskId
      ? all
          .filter((s) => s.task_id === taskId)
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      : [];
    return {
      items,
      done: items.filter((s) => s.is_completed).length,
      total: items.length,
    };
  }, [all, taskId]);
}

interface TaskSubtasksProps {
  taskId: string;
  accentColor?: string;
  /** Compact styling for inside a task card. */
  compact?: boolean;
}

export function TaskSubtasks({
  taskId,
  accentColor = "var(--primary)",
  compact = false,
}: TaskSubtasksProps) {
  const { items } = useTaskSubtasks(taskId);
  const saveSubtasks = useSaveSubtasks();
  const updateSubtask = useUpdateSubtask();
  const deleteSubtask = useDeleteSubtask();
  const [draft, setDraft] = useState("");

  const add = () => {
    const title = draft.trim();
    if (!title) return;
    saveSubtasks.mutate([
      {
        title,
        task_id: taskId,
        goal_id: null,
        position: items.length,
        is_completed: false,
      },
    ]);
    setDraft("");
  };

  const toggle = (s: Subtask) => {
    updateSubtask.mutate({
      id: s.id,
      patch: {
        is_completed: !s.is_completed,
        completed_at: !s.is_completed ? new Date().toISOString() : null,
      },
    });
  };

  return (
    <div className={cn("space-y-1.5", compact ? "text-xs" : "text-sm")}>
      {items.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No steps yet — break this task into small, tickable pieces.
        </p>
      )}

      {items.map((s) => (
        <div
          key={s.id}
          className="group/sub flex items-center gap-2 rounded-lg border border-border/50 bg-surface/50 px-2 py-1.5"
        >
          <button
            type="button"
            onClick={() => toggle(s)}
            aria-label={s.is_completed ? `Untick "${s.title}"` : `Tick off "${s.title}"`}
            className={cn(
              "grid size-5 shrink-0 place-items-center rounded-md border transition-colors cursor-pointer",
              s.is_completed ? "border-transparent" : "border-border hover:border-primary/60",
            )}
            style={
              s.is_completed
                ? { background: `color-mix(in oklab, ${accentColor} 30%, transparent)` }
                : undefined
            }
          >
            {s.is_completed && (
              <Check className="size-3" strokeWidth={3} style={{ color: accentColor }} />
            )}
          </button>
          <span
            className={cn(
              "min-w-0 flex-1 truncate",
              s.is_completed ? "text-muted-foreground line-through" : "text-foreground",
            )}
          >
            {s.title}
          </span>
          <button
            type="button"
            onClick={() => deleteSubtask.mutate(s.id)}
            aria-label={`Delete step "${s.title}"`}
            className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/sub:opacity-100 focus-visible:opacity-100 cursor-pointer"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ))}

      <div className="flex items-center gap-1.5 pt-0.5">
        <ListChecks className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Add a step…"
          aria-label="Add a step"
          className="h-8 min-w-0 flex-1 rounded-lg border border-border/60 bg-surface px-2 text-xs text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          aria-label="Add step"
          className="grid size-8 shrink-0 place-items-center rounded-lg border border-border/60 bg-surface text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-40 cursor-pointer"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}
