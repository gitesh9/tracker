import { useMemo } from "react";
import { useSubtasks } from "@/lib/ascend/queries";
import type { Subtask } from "@/lib/ascend/types";

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
