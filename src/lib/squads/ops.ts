/**
 * Shared squad operations — the single set of rules used by the server (to apply a
 * change for everyone in the squad) and by the browser (to show it instantly).
 *
 * Every operation carries an id; a squad remembers recently applied ids so a change
 * that is retried after a dropped connection is never applied twice.
 */
import type { Domain, TeamGoal, TeamMember, TeamSquad, TeamTask } from "@/lib/ascend/types";

export type Actor = {
  id: string;
  name: string;
  streak?: number;
  todayCompletions?: number;
};

export type GoalInput = {
  id: string;
  title: string;
  domain: Domain;
  targetCount: number;
  unit: string;
  deadline?: string;
};

export type TaskInput = {
  id: string;
  title: string;
  domain: Domain;
  assignedTo?: string;
  assignedName?: string;
  estimatedMinutes?: number;
  priority?: "p1" | "p2" | "p3";
  dueDate?: string;
};

export type SquadOp =
  | { opId: string; kind: "create"; squadId: string; name: string; description: string; code: string }
  | { opId: string; kind: "import"; squad: TeamSquad }
  | { opId: string; kind: "join"; code: string }
  | { opId: string; kind: "leave"; squadId: string }
  | { opId: string; kind: "add_goal"; squadId: string; goal: GoalInput }
  | { opId: string; kind: "add_task"; squadId: string; task: TaskInput }
  | { opId: string; kind: "set_task_done"; squadId: string; taskId: string; done: boolean }
  | { opId: string; kind: "cheer"; squadId: string; memberId: string };

export type SharedSquad = TeamSquad & { appliedOps?: string[] };

const MAX_REMEMBERED_OPS = 300;
const LOCAL_ME_IDS = new Set(["member-me", "guest_user", ""]);

export function newInviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I confusion
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `SQUAD-${out}`;
}

export function normaliseCode(code: string): string {
  const trimmed = code.trim().toUpperCase().replace(/\s+/g, "");
  return trimmed.startsWith("SQUAD-") ? trimmed : `SQUAD-${trimmed}`;
}

function memberFor(actor: Actor, role: TeamMember["role"]): TeamMember {
  return {
    id: actor.id,
    name: actor.name,
    role,
    currentStreak: actor.streak ?? 0,
    todayCompletions: actor.todayCompletions ?? 0,
    lastActive: new Date().toISOString(),
    cheersReceived: 0,
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function isMember(squad: TeamSquad, actorId: string): boolean {
  return squad.members.some((m) => m.id === actorId);
}

/** Builds a brand-new squad led by the actor. */
export function createSquadDoc(
  op: Extract<SquadOp, { kind: "create" }>,
  actor: Actor,
): SharedSquad {
  return {
    id: op.squadId,
    name: op.name.slice(0, 80),
    description: op.description.slice(0, 400),
    code: op.code,
    createdAt: new Date().toISOString(),
    members: [memberFor(actor, "leader")],
    goals: [],
    tasks: [],
    appliedOps: [op.opId],
  };
}

/** Turns a squad made on this device before signing in into one owned by the actor. */
export function importSquadDoc(squad: TeamSquad, actor: Actor, opId: string): SharedSquad {
  const doc = clone(squad) as SharedSquad;
  const swap = (id: string | undefined) => (id && !LOCAL_ME_IDS.has(id) ? id : actor.id);
  const others = doc.members.filter((m) => !LOCAL_ME_IDS.has(m.id) && m.id !== actor.id);
  const mine = doc.members.find((m) => LOCAL_ME_IDS.has(m.id) || m.id === actor.id);
  doc.members = [
    { ...(mine ?? memberFor(actor, "leader")), id: actor.id, name: actor.name, role: "leader" },
    ...others,
  ];
  doc.goals = (doc.goals ?? []).map((g) => ({
    ...g,
    contributors: (g.contributors ?? []).map((c) => ({ ...c, memberId: swap(c.memberId) })),
  }));
  doc.tasks = (doc.tasks ?? []).map((t) =>
    t.assignedTo && LOCAL_ME_IDS.has(t.assignedTo) ? { ...t, assignedTo: actor.id } : t,
  );
  doc.appliedOps = [opId];
  return doc;
}

export function addMember(squad: SharedSquad, actor: Actor): SharedSquad {
  if (isMember(squad, actor.id)) return squad;
  const doc = clone(squad);
  doc.members.push(memberFor(actor, "member"));
  return doc;
}

/** Applies an in-squad change. Returns the squad unchanged when the op was seen before
 *  or does not apply (unknown task, not a member). */
export function applySquadOp(squad: SharedSquad, op: SquadOp, actor: Actor): SharedSquad {
  if (squad.appliedOps?.includes(op.opId)) return squad;
  const doc = clone(squad);
  const remember = () => {
    doc.appliedOps = [...(doc.appliedOps ?? []), op.opId].slice(-MAX_REMEMBERED_OPS);
  };

  switch (op.kind) {
    case "add_goal": {
      if (doc.goals.some((g) => g.id === op.goal.id)) break;
      const goal: TeamGoal = {
        id: op.goal.id,
        squadId: doc.id,
        title: op.goal.title.slice(0, 160),
        domain: op.goal.domain,
        targetCount: Math.max(1, Math.min(100_000, Math.round(op.goal.targetCount) || 10)),
        currentCount: 0,
        unit: (op.goal.unit || "tasks").slice(0, 40),
        ...(op.goal.deadline ? { deadline: op.goal.deadline } : {}),
        isCompleted: false,
        contributors: [{ memberId: actor.id, name: actor.name, count: 0 }],
        createdAt: new Date().toISOString(),
      };
      doc.goals.push(goal);
      break;
    }
    case "add_task": {
      if (doc.tasks.some((t) => t.id === op.task.id)) break;
      const task: TeamTask = {
        id: op.task.id,
        squadId: doc.id,
        title: op.task.title.slice(0, 160),
        domain: op.task.domain,
        assignedTo: op.task.assignedTo || "everyone",
        assignedName: (op.task.assignedName || "Everyone").slice(0, 80),
        estimatedMinutes: op.task.estimatedMinutes || 30,
        priority: op.task.priority || "p2",
        ...(op.task.dueDate ? { dueDate: op.task.dueDate } : {}),
        isCompleted: false,
        createdAt: new Date().toISOString(),
      };
      doc.tasks.unshift(task);
      break;
    }
    case "set_task_done": {
      const task = doc.tasks.find((t) => t.id === op.taskId);
      if (!task || task.isCompleted === op.done) break;
      const me = doc.members.find((m) => m.id === actor.id);
      task.isCompleted = op.done;
      if (op.done) {
        task.completedBy = actor.name;
        task.completedAt = new Date().toISOString();
        if (me) me.todayCompletions += 1;
        for (const g of doc.goals) {
          if (g.isCompleted) continue;
          g.currentCount = Math.min(g.targetCount, (g.currentCount || 0) + 1);
          if (g.currentCount >= g.targetCount) g.isCompleted = true;
          const c = g.contributors.find((x) => x.memberId === actor.id);
          if (c) c.count += 1;
          else g.contributors.push({ memberId: actor.id, name: actor.name, count: 1 });
        }
      } else {
        delete task.completedBy;
        delete task.completedAt;
        if (me && me.todayCompletions > 0) me.todayCompletions -= 1;
      }
      break;
    }
    case "cheer": {
      const member = doc.members.find((m) => m.id === op.memberId);
      if (!member || member.id === actor.id) break;
      member.cheersReceived = (member.cheersReceived || 0) + 1;
      break;
    }
    case "leave": {
      doc.members = doc.members.filter((m) => m.id !== actor.id);
      if (doc.members.length > 0 && !doc.members.some((m) => m.role === "leader")) {
        doc.members[0]!.role = "leader";
      }
      break;
    }
    default:
      return squad;
  }
  remember();
  return doc;
}

/** Refreshes the actor's own streak / today numbers. Returns null when nothing changed. */
export function touchMember(squad: SharedSquad, actor: Actor): SharedSquad | null {
  const me = squad.members.find((m) => m.id === actor.id);
  if (!me) return null;
  const last = Date.parse(me.lastActive);
  const stale = !Number.isFinite(last) || Date.now() - last > 5 * 60_000;
  const streak = actor.streak ?? me.currentStreak;
  const today = actor.todayCompletions ?? me.todayCompletions;
  if (!stale && me.currentStreak === streak && me.todayCompletions === today && me.name === actor.name)
    return null;
  const doc = clone(squad);
  const m = doc.members.find((x) => x.id === actor.id)!;
  m.currentStreak = streak;
  m.todayCompletions = today;
  m.name = actor.name;
  m.lastActive = new Date().toISOString();
  return doc;
}

/** "Just now", "5 min ago", "3 h ago", "2 d ago" for ISO timestamps; passes other text through. */
export function formatLastActive(value: string | undefined): string {
  if (!value) return "Just now";
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return value;
  const mins = Math.max(0, Math.round((Date.now() - t) / 60_000));
  if (mins < 2) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}
