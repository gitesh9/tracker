/**
 * Squads shared with other people (browser side).
 *
 * Changes show instantly on this device, wait in a small outbox while offline, and
 * are sent to the server, which applies them for everyone in the squad. The server's
 * copy then replaces the local one, so teammates' changes appear here too.
 */
import { cachedAccount } from "@/lib/auth/account";
import { localDB } from "./local-store";
import {
  applySquadOp,
  createSquadDoc,
  newInviteCode,
  type Actor,
  type GoalInput,
  type SharedSquad,
  type SquadOp,
  type TaskInput,
} from "@/lib/squads/ops";
import type { TeamSquad } from "./types";
import { todayISO } from "./cadence";

const OUTBOX = "ascend.squads.outbox.v1";
const IMPORTED = "ascend.squads.imported.v1";

type Response = {
  configured: boolean;
  squads: TeamSquad[];
  results: { opId: string; ok: boolean; squadId?: string; error?: string }[];
};

export class SquadError extends Error {
  constructor(
    public code: "not_found" | "offline" | "signin" | "unavailable" | "forbidden",
    message: string,
  ) {
    super(message);
  }
}

function readOutbox(): SquadOp[] {
  try {
    const v = JSON.parse(localStorage.getItem(OUTBOX) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function writeOutbox(ops: SquadOp[]) {
  try {
    localStorage.setItem(OUTBOX, JSON.stringify(ops));
  } catch {
    /* storage full — the change still shows locally */
  }
}

export function squadOutboxSize(): number {
  return typeof window === "undefined" ? 0 : readOutbox().length;
}

function me(): Actor & { name: string } {
  const account = cachedAccount();
  const profile = localDB.getProfile();
  const today = todayISO();
  const todayCompletions = localDB
    .getTasks()
    .filter((t) => t.completed_dates?.includes(today) || (t.is_completed && t.due_date === today))
    .length;
  return {
    id: account?.id ?? "member-me",
    name: (profile.display_name || account?.name || account?.email?.split("@")[0] || "You").slice(
      0,
      80,
    ),
    streak: profile.current_streak || 0,
    todayCompletions,
  };
}

async function post(ops: SquadOp[]): Promise<Response> {
  const actor = me();
  let res: globalThis.Response;
  try {
    res = await fetch("/api/public/squads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        ops,
        me: { name: actor.name, streak: actor.streak, todayCompletions: actor.todayCompletions },
      }),
    });
  } catch {
    throw new SquadError("offline", "You're offline — this will sync when you reconnect.");
  }
  if (res.status === 401) throw new SquadError("signin", "Sign in again to sync your squads.");
  if (!res.ok) throw new SquadError("unavailable", "Squads are temporarily unavailable.");
  return (await res.json()) as Response;
}

/** Replaces local squads with the server's list, keeping squads still waiting to be sent. */
function adopt(server: TeamSquad[]) {
  const waiting = new Set(
    readOutbox().flatMap((o) => (o.kind === "create" ? [o.squadId] : o.kind === "import" ? [o.squad.id] : [])),
  );
  const keep = localDB.getSquads().filter((s) => waiting.has(s.id) && !server.some((x) => x.id === s.id));
  localDB.replaceSquads([...server, ...keep]);
}

/** Squads made on this device before sign-in become real shared squads, once. */
function queueImports() {
  let done: string[] = [];
  try {
    done = JSON.parse(localStorage.getItem(IMPORTED) ?? "[]");
  } catch {
    done = [];
  }
  const outbox = readOutbox();
  const queued = new Set(outbox.flatMap((o) => (o.kind === "create" ? [o.squadId] : o.kind === "import" ? [o.squad.id] : [])));
  const fresh = localDB.getSquads().filter((s) => !done.includes(s.id) && !queued.has(s.id));
  if (fresh.length === 0) return;
  writeOutbox([
    ...fresh.map((s) => ({ opId: crypto.randomUUID(), kind: "import" as const, squad: s })),
    ...outbox,
  ]);
  localStorage.setItem(IMPORTED, JSON.stringify([...done, ...fresh.map((s) => s.id)]));
}

let syncing: Promise<boolean> | null = null;

/** Sends waiting changes and pulls the latest squads. Returns true when anything was received. */
export function syncSquads(): Promise<boolean> {
  if (typeof window === "undefined" || !cachedAccount()) return Promise.resolve(false);
  if (!syncing) {
    syncing = (async () => {
      queueImports();
      const ops = readOutbox();
      const res = await post(ops);
      if (!res.configured) return false;
      const sent = new Set(ops.map((o) => o.opId));
      writeOutbox(readOutbox().filter((o) => !sent.has(o.opId)));
      adopt(res.squads);
      return true;
    })()
      .catch((err) => {
        if (!(err instanceof SquadError)) console.warn("[Ascend] squad sync failed", err);
        return false;
      })
      .finally(() => {
        syncing = null;
      });
  }
  return syncing;
}

/** Shows a change now, queues it, then tries to send it straight away. */
async function run(op: SquadOp, local: (squad: SharedSquad) => SharedSquad): Promise<void> {
  if ("squadId" in op && op.kind !== "create") {
    const squad = localDB.getSquads().find((s) => s.id === op.squadId);
    if (squad) localDB.saveSquadLocal(local(squad));
  }
  writeOutbox([...readOutbox(), op]);
  await syncSquads();
}

export async function createSharedSquad(name: string, description: string): Promise<TeamSquad> {
  const op = {
    opId: crypto.randomUUID(),
    kind: "create" as const,
    squadId: `squad-${crypto.randomUUID()}`,
    name,
    description,
    code: newInviteCode(),
  };
  localDB.saveSquadLocal(createSquadDoc(op, me()));
  writeOutbox([...readOutbox(), op]);
  await syncSquads();
  return localDB.getSquads().find((s) => s.id === op.squadId)!;
}

/** Joining needs the server: the squad lives with whoever created it. */
export async function joinSharedSquad(code: string): Promise<TeamSquad> {
  const op = { opId: crypto.randomUUID(), kind: "join" as const, code };
  const res = await post([op]);
  if (!res.configured) throw new SquadError("unavailable", "Squad sharing isn't set up on the server.");
  adopt(res.squads);
  const result = res.results[0];
  if (!result?.ok || !result.squadId) {
    throw new SquadError("not_found", "Squad not found. Check the invite code and try again.");
  }
  return res.squads.find((s) => s.id === result.squadId)!;
}

export function addSharedGoal(squadId: string, goal: Omit<GoalInput, "id">) {
  const op = { opId: crypto.randomUUID(), kind: "add_goal" as const, squadId, goal: { ...goal, id: `tgoal-${crypto.randomUUID()}` } };
  return run(op, (s) => applySquadOp(s, op, me()));
}

export function addSharedTask(squadId: string, task: Omit<TaskInput, "id">) {
  const op = { opId: crypto.randomUUID(), kind: "add_task" as const, squadId, task: { ...task, id: `ttask-${crypto.randomUUID()}` } };
  return run(op, (s) => applySquadOp(s, op, me()));
}

export async function setSharedTaskDone(squadId: string, taskId: string, done: boolean) {
  const op = { opId: crypto.randomUUID(), kind: "set_task_done" as const, squadId, taskId, done };
  await run(op, (s) => applySquadOp(s, op, me()));
  return localDB.getSquads().find((s) => s.id === squadId)?.tasks.find((t) => t.id === taskId) ?? null;
}

export async function cheerShared(squadId: string, memberId: string) {
  const op = { opId: crypto.randomUUID(), kind: "cheer" as const, squadId, memberId };
  await run(op, (s) => applySquadOp(s, op, { ...me(), id: `${me().id}:local` }));
  return localDB.getSquads().find((s) => s.id === squadId)?.members.find((m) => m.id === memberId)?.cheersReceived ?? 0;
}

export async function leaveSharedSquad(squadId: string) {
  const op = { opId: crypto.randomUUID(), kind: "leave" as const, squadId };
  localDB.replaceSquads(localDB.getSquads().filter((s) => s.id !== squadId));
  writeOutbox([...readOutbox(), op]);
  await syncSquads();
}

