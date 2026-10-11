import { SignInRequiredError, syncWithRemote, type WireOp } from "@/lib/sync/remote";
import type { LocalTable } from "@/lib/db/pglite";
import type { Task } from "./types";

const KEY = "ascend.offline.queue.v1";
const MAX_SERVER_FAILURES = 5;

export type QueueTable =
  | "tasks"
  | "goals"
  | "subtasks"
  | "focus_sessions"
  | "deferral_logs"
  | "reminders"
  | "achievements"
  | "profiles"
  | "squads";

type Base = { id: string; at: number; attempts?: number | undefined };

export type QueuedOp =
  | (Base & { kind: "upsert"; table: QueueTable; rowId: string; row: Record<string, unknown> })
  | (Base & { kind: "update"; table: QueueTable; rowId: string; patch: Record<string, unknown> })
  | (Base & { kind: "delete"; table: QueueTable; rowId: string })
  // Legacy shapes kept so queues written by earlier versions still replay.
  | (Base & { kind: "task_update"; taskId: string; patch: Partial<Task> })
  | (Base & { kind: "focus_session"; payload: Record<string, unknown> });

export type NewOp =
  | { kind: "upsert"; table: QueueTable; rowId: string; row: Record<string, unknown> }
  | { kind: "update"; table: QueueTable; rowId: string; patch: Record<string, unknown> }
  | { kind: "delete"; table: QueueTable; rowId: string }
  | { kind: "task_update"; taskId: string; patch: Partial<Task> }
  | { kind: "focus_session"; payload: Record<string, unknown> };

function read(): QueuedOp[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as QueuedOp[]) : [];
  } catch {
    return [];
  }
}

function write(ops: QueuedOp[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ops));
  } catch {
    // quota exceeded / private mode — keep the in-memory dispatch so the UI still updates
  }
  window.dispatchEvent(new CustomEvent("ascend:queue", { detail: ops.length }));
}

export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export function queueSize(): number {
  return read().length;
}

/** Tables that currently have unsynced local writes. Reads for these tables should
 *  come from the local mirror until the queue drains, so a refetch never overwrites
 *  a change the user made while offline. */
export function pendingTables(): Set<QueueTable> {
  const set = new Set<QueueTable>();
  for (const op of read()) {
    if (op.kind === "task_update") set.add("tasks");
    else if (op.kind === "focus_session") set.add("focus_sessions");
    else set.add(op.table);
  }
  return set;
}

export function hasPending(table: QueueTable): boolean {
  return pendingTables().has(table);
}

function normalise(op: NewOp): NewOp {
  if (op.kind === "task_update") {
    return {
      kind: "update",
      table: "tasks",
      rowId: op.taskId,
      patch: op.patch as Record<string, unknown>,
    };
  }
  if (op.kind === "focus_session") {
    const rowId =
      typeof op.payload["id"] === "string" ? (op.payload["id"] as string) : crypto.randomUUID();
    return { kind: "upsert", table: "focus_sessions", rowId, row: { ...op.payload, id: rowId } };
  }
  return op;
}

function keyOf(op: QueuedOp): string | null {
  if (op.kind === "task_update") return `tasks:${op.taskId}`;
  if (op.kind === "focus_session") return null;
  return `${op.table}:${op.rowId}`;
}

/** Adds a write to the queue, collapsing it with earlier writes to the same row so a
 *  reconnect replays one final state instead of every intermediate keystroke. */
export function enqueue(input: NewOp) {
  const op = normalise(input);
  const ops = read();
  const stamp = { id: crypto.randomUUID(), at: Date.now() };

  if (op.kind === "focus_session" || op.kind === "task_update") {
    ops.push({ ...op, ...stamp } as QueuedOp);
    write(ops);
    return;
  }

  const key = `${op.table}:${op.rowId}`;
  const index = ops.findIndex((o) => keyOf(o) === key);
  const existing = index >= 0 ? ops[index]! : null;

  if (op.kind === "delete") {
    // Nothing queued for this row needs to survive a delete.
    let next = ops.filter((o) => keyOf(o) !== key);
    // Children of a deleted parent cascade on the server; drop their pending writes too.
    if (op.table === "tasks" || op.table === "goals") {
      const parentField = op.table === "tasks" ? "task_id" : "goal_id";
      next = next.filter(
        (o) =>
          !(
            o.kind === "upsert" &&
            o.table === "subtasks" &&
            (o.row as Record<string, unknown>)[parentField] === op.rowId
          ),
      );
    }
    // A row that only ever existed in this queue never reached the server.
    const neverSynced = existing?.kind === "upsert";
    if (!neverSynced) next.push({ ...op, ...stamp });
    write(next);
    return;
  }

  if (op.kind === "update") {
    if (existing?.kind === "upsert") {
      ops[index] = { ...existing, ...stamp, row: { ...existing.row, ...op.patch } };
      write(ops);
      return;
    }
    if (existing && (existing.kind === "update" || existing.kind === "task_update")) {
      const prevPatch =
        existing.kind === "update" ? existing.patch : (existing.patch as Record<string, unknown>);
      ops[index] = {
        ...stamp,
        kind: "update",
        table: op.table,
        rowId: op.rowId,
        patch: { ...prevPatch, ...op.patch },
        attempts: existing.attempts,
      };
      write(ops);
      return;
    }
    ops.push({ ...op, ...stamp });
    write(ops);
    return;
  }

  // upsert
  if (existing?.kind === "upsert") {
    ops[index] = { ...existing, ...stamp, row: { ...existing.row, ...op.row } };
  } else if (existing && (existing.kind === "update" || existing.kind === "task_update")) {
    const prevPatch =
      existing.kind === "update" ? existing.patch : (existing.patch as Record<string, unknown>);
    ops[index] = {
      ...stamp,
      kind: "upsert",
      table: op.table,
      rowId: op.rowId,
      row: { ...prevPatch, ...op.row },
    };
  } else {
    ops.push({ ...op, ...stamp });
  }
  write(ops);
}

function isNetworkFailure(err: unknown): boolean {
  if (err instanceof TypeError) return true; // fetch() rejected: no connection / DNS / CORS
  const message = err instanceof Error ? err.message : String(err ?? "");
  return /fetch|network|load failed|timed? ?out|ECONN|ENOTFOUND/i.test(message);
}

/** Turns a queued op into the wire shape the remote sync endpoint understands. */
function toWireOp(op: QueuedOp): WireOp | null {
  if (op.kind === "task_update") {
    return {
      kind: "update",
      table: "tasks",
      id: op.taskId,
      patch: op.patch as Record<string, unknown>,
      at: op.at,
    };
  }
  if (op.kind === "focus_session") {
    const id = typeof op.payload["id"] === "string" ? (op.payload["id"] as string) : null;
    if (!id) return null;
    return { kind: "upsert", table: "focus_sessions", id, row: op.payload, at: op.at };
  }
  if (op.kind === "delete") return { kind: "delete", table: op.table as LocalTable, id: op.rowId };
  if (op.kind === "update")
    return { kind: "update", table: op.table as LocalTable, id: op.rowId, patch: op.patch, at: op.at };
  return { kind: "upsert", table: op.table as LocalTable, id: op.rowId, row: op.row, at: op.at };
}

let flushing: Promise<number> | null = null;

/** Replays queued writes to the remote database. Everything stays queued when the
 *  push fails for network reasons; repeated server rejections drop the op so one bad
 *  row can't block the rest. Without a remote database configured the queue is cleared,
 *  because the local database already holds the change. */
export function flushQueue(): Promise<number> {
  if (flushing) return flushing;
  flushing = flushInternal().finally(() => {
    flushing = null;
  });
  return flushing;
}

async function flushInternal(): Promise<number> {
  if (isOffline()) return 0;
  const ops = read();
  if (ops.length === 0) return 0;

  const wire = ops.map(toWireOp).filter((o): o is WireOp => o !== null);

  try {
    const configured = await syncWithRemote(wire);
    // A new click can replace a queued op while this request is in flight.
    // Clear only the exact versions sent, never those newer edits.
    const sent = new Map(ops.map((op) => [op.id, op.at]));
    write(read().filter((op) => sent.get(op.id) !== op.at));
    return configured ? ops.length : 0;
  } catch (err) {
    if (isNetworkFailure(err)) return 0; // stays queued for the next attempt
    if (err instanceof SignInRequiredError) {
      window.dispatchEvent(new CustomEvent("ascend:signin-required"));
      return 0; // stays queued until the user signs in again
    }
    const sent = new Map(ops.map((op) => [op.id, op.at]));
    const remaining: QueuedOp[] = [];
    for (const op of read()) {
      if (sent.get(op.id) !== op.at) { remaining.push(op); continue; }
      const attempts = (op.attempts ?? 0) + 1;
      if (attempts < MAX_SERVER_FAILURES) remaining.push({ ...op, attempts });
      else console.warn("[Ascend] dropping unsyncable change", op, err);
    }
    write(remaining);
    return 0;
  }
}

/** Pulls remote changes without having anything to push. */
export async function pullRemote(): Promise<boolean> {
  if (isOffline()) return false;
  try {
    return await syncWithRemote([]);
  } catch (err) {
    if (err instanceof SignInRequiredError) {
      window.dispatchEvent(new CustomEvent("ascend:signin-required"));
    }
    return false;
  }
}
