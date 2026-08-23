import { supabase } from "@/integrations/supabase/client";
import type { Task } from "./types";

const KEY = "ascend.offline.queue.v1";

export type QueuedOp =
  | { id: string; at: number; kind: "task_update"; taskId: string; patch: Partial<Task> }
  | { id: string; at: number; kind: "focus_session"; payload: Record<string, unknown> };

function read(): QueuedOp[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as QueuedOp[];
  } catch {
    return [];
  }
}

function write(ops: QueuedOp[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(ops));
  window.dispatchEvent(new CustomEvent("ascend:queue", { detail: ops.length }));
}

export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export function queueSize(): number {
  return read().length;
}

type NewOp =
  | { kind: "task_update"; taskId: string; patch: Partial<Task> }
  | { kind: "focus_session"; payload: Record<string, unknown> };

export function enqueue(op: NewOp) {
  const ops = read();
  // Collapse repeated edits to the same task so a reconnect writes one final state.
  if (op.kind === "task_update") {
    const index = ops.findIndex((o) => o.kind === "task_update" && o.taskId === op.taskId);
    if (index >= 0) {
      const existing = ops[index] as Extract<QueuedOp, { kind: "task_update" }>;
      ops[index] = { ...existing, patch: { ...existing.patch, ...op.patch }, at: Date.now() };
      write(ops);
      return;
    }
  }
  ops.push({ ...op, id: crypto.randomUUID(), at: Date.now() });
  write(ops);
}

/** Replays queued writes oldest-first. Ops that fail stay queued for the next attempt. */
export async function flushQueue(): Promise<number> {
  if (isOffline()) return 0;
  const ops = read();
  if (ops.length === 0) return 0;

  const remaining: QueuedOp[] = [];
  let flushed = 0;

  for (const op of ops) {
    try {
      if (op.kind === "task_update") {
        const { error } = await supabase.from("tasks").update(op.patch).eq("id", op.taskId);
        if (error) throw new Error(error.message);
      } else {
        const { data } = await supabase.auth.getUser();
        if (!data.user) throw new Error("No session");
        const { error } = await supabase
          .from("focus_sessions")
          .insert({ ...op.payload, user_id: data.user.id } as never);
        if (error) throw new Error(error.message);
      }
      flushed++;
    } catch {
      remaining.push(op);
    }
  }

  write(remaining);
  return flushed;
}
