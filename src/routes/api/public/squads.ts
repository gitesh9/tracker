import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ensureSchema, getSql } from "@/lib/db/neon.server";
import { getSessionUser } from "@/lib/auth/session.server";
import {
  addMember,
  applySquadOp,
  createSquadDoc,
  importSquadDoc,
  isMember,
  newInviteCode,
  normaliseCode,
  touchMember,
  type Actor,
  type SharedSquad,
  type SquadOp,
} from "@/lib/squads/ops";

/**
 * Shared squads. Only signed-in members can read or change a squad; joining needs
 * its invite code. Each change is applied to the latest copy with a version check,
 * so two people editing at once never overwrite each other.
 */

const id = z.string().min(1).max(100);
const domain = z.string().min(1).max(40);
const goal = z.object({
  id,
  title: z.string().min(1).max(160),
  domain,
  targetCount: z.number().finite(),
  unit: z.string().max(40),
  deadline: z.string().max(40).optional(),
});
const task = z.object({
  id,
  title: z.string().min(1).max(160),
  domain,
  assignedTo: z.string().max(100).optional(),
  assignedName: z.string().max(80).optional(),
  estimatedMinutes: z.number().finite().optional(),
  priority: z.enum(["p1", "p2", "p3"]).optional(),
  dueDate: z.string().max(40).optional(),
});
const opSchema = z.discriminatedUnion("kind", [
  z.object({
    opId: id,
    kind: z.literal("create"),
    squadId: id,
    name: z.string().min(1).max(80),
    description: z.string().max(400),
    code: z.string().min(4).max(40),
  }),
  z.object({ opId: id, kind: z.literal("import"), squad: z.record(z.string(), z.unknown()) }),
  z.object({ opId: id, kind: z.literal("join"), code: z.string().min(3).max(40) }),
  z.object({ opId: id, kind: z.literal("leave"), squadId: id }),
  z.object({ opId: id, kind: z.literal("add_goal"), squadId: id, goal }),
  z.object({ opId: id, kind: z.literal("add_task"), squadId: id, task }),
  z.object({
    opId: id,
    kind: z.literal("set_task_done"),
    squadId: id,
    taskId: id,
    done: z.boolean(),
  }),
  z.object({ opId: id, kind: z.literal("cheer"), squadId: id, memberId: id }),
]);
const bodySchema = z.object({
  ops: z.array(opSchema).max(100).default([]),
  me: z
    .object({
      streak: z.number().int().min(0).max(100_000).optional(),
      todayCompletions: z.number().int().min(0).max(100_000).optional(),
      name: z.string().min(1).max(80).optional(),
    })
    .optional(),
});

type Sql = NonNullable<ReturnType<typeof getSql>>;
type Row = { id: string; data: SharedSquad; version: number };
type OpResult = { opId: string; ok: boolean; squadId?: string; error?: string };

async function load(sql: Sql, squadId: string): Promise<Row | null> {
  const rows = (await sql`
    select id, data, version from ascend_squads where id = ${squadId} limit 1`) as Row[];
  return rows[0] ?? null;
}

/** Read → change → write only if nobody else wrote in between; retries on a clash. */
async function mutate(
  sql: Sql,
  squadId: string,
  change: (doc: SharedSquad) => SharedSquad | null,
): Promise<SharedSquad | null> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const row = await load(sql, squadId);
    if (!row) return null;
    const next = change(row.data);
    if (!next || next === row.data) return row.data;
    const written = (await sql`
      update ascend_squads
      set data = ${JSON.stringify(next)}::jsonb, version = version + 1, updated_at = now()
      where id = ${squadId} and version = ${row.version}
      returning id`) as unknown[];
    if (written.length > 0) return next;
  }
  throw new Error("Squad is busy, try again");
}

async function insertSquad(sql: Sql, doc: SharedSquad, actorId: string): Promise<SharedSquad> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const rows = (await sql`
      insert into ascend_squads (id, code, data)
      values (${doc.id}, ${doc.code}, ${JSON.stringify(doc)}::jsonb)
      on conflict do nothing
      returning id`) as unknown[];
    if (rows.length > 0) break;
    const existing = await load(sql, doc.id);
    if (existing) return existing.data; // same squad already created (retried request)
    doc = { ...doc, code: newInviteCode() }; // invite code clash — pick another
  }
  await sql`
    insert into ascend_squad_members (squad_id, account_id)
    values (${doc.id}, ${actorId}) on conflict do nothing`;
  return doc;
}

async function apply(sql: Sql, op: SquadOp, actor: Actor): Promise<OpResult> {
  const fail = (error: string): OpResult => ({ opId: op.opId, ok: false, error });

  if (op.kind === "create") {
    const doc = await insertSquad(sql, createSquadDoc(op, actor), actor.id);
    return { opId: op.opId, ok: true, squadId: doc.id };
  }
  if (op.kind === "import") {
    const raw = op.squad as unknown as SharedSquad;
    if (typeof raw.id !== "string" || !Array.isArray(raw.members)) return fail("invalid");
    const existing = await load(sql, raw.id);
    if (existing) {
      return isMember(existing.data, actor.id)
        ? { opId: op.opId, ok: true, squadId: raw.id }
        : fail("forbidden");
    }
    const doc = importSquadDoc(
      { ...raw, code: newInviteCode(), goals: raw.goals ?? [], tasks: raw.tasks ?? [] },
      actor,
      op.opId,
    );
    await insertSquad(sql, doc, actor.id);
    return { opId: op.opId, ok: true, squadId: doc.id };
  }
  if (op.kind === "join") {
    const code = normaliseCode(op.code);
    const rows = (await sql`
      select id from ascend_squads where upper(code) = ${code} limit 1`) as { id: string }[];
    const squadId = rows[0]?.id;
    if (!squadId) return fail("not_found");
    await mutate(sql, squadId, (doc) => addMember(doc, actor));
    await sql`
      insert into ascend_squad_members (squad_id, account_id)
      values (${squadId}, ${actor.id}) on conflict do nothing`;
    return { opId: op.opId, ok: true, squadId };
  }

  // Everything else needs membership.
  const member = (await sql`
    select 1 from ascend_squad_members
    where squad_id = ${op.squadId} and account_id = ${actor.id} limit 1`) as unknown[];
  if (member.length === 0) return fail("forbidden");
  const doc = await mutate(sql, op.squadId, (d) => applySquadOp(d, op, actor));
  if (!doc) return fail("not_found");
  if (op.kind === "leave") {
    await sql`
      delete from ascend_squad_members
      where squad_id = ${op.squadId} and account_id = ${actor.id}`;
    if (doc.members.length === 0) await sql`delete from ascend_squads where id = ${op.squadId}`;
  }
  return { opId: op.opId, ok: true, squadId: op.squadId };
}

export const Route = createFileRoute("/api/public/squads")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const sql = getSql();
        if (!sql) return Response.json({ configured: false, squads: [], results: [] });
        const parsed = bodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

        try {
          await ensureSchema(sql);
          const user = await getSessionUser(request);
          if (!user) return Response.json({ error: "Please sign in again" }, { status: 401 });
          const actor: Actor = {
            id: user.id,
            name: (parsed.data.me?.name || user.name || "Member").slice(0, 80),
            ...(parsed.data.me?.streak !== undefined ? { streak: parsed.data.me.streak } : {}),
            ...(parsed.data.me?.todayCompletions !== undefined
              ? { todayCompletions: parsed.data.me.todayCompletions }
              : {}),
          };

          const results: OpResult[] = [];
          for (const op of parsed.data.ops as SquadOp[]) {
            try {
              results.push(await apply(sql, op, actor));
            } catch (err) {
              console.error("[squads] op failed", op.kind, err);
              results.push({ opId: op.opId, ok: false, error: "busy" });
            }
          }

          const mine = (await sql`
            select s.id, s.data, s.version from ascend_squads s
            join ascend_squad_members m on m.squad_id = s.id
            where m.account_id = ${user.id}
            order by s.updated_at desc
            limit 50`) as Row[];

          const squads: SharedSquad[] = [];
          for (const row of mine) {
            let doc = row.data;
            if (touchMember(doc, actor)) {
              doc = (await mutate(sql, row.id, (d) => touchMember(d, actor))) ?? doc;
            }
            const { appliedOps: _drop, ...visible } = doc;
            squads.push(visible as SharedSquad);
          }
          return Response.json({ configured: true, squads, results });
        } catch (err) {
          console.error("[squads] request failed", err);
          return Response.json({ error: "Squads unavailable" }, { status: 503 });
        }
      },
    },
  },
});
