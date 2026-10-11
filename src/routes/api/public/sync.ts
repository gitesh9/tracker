import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ensureSchema, getSql } from "@/lib/db/neon.server";
import { getSessionUser } from "@/lib/auth/session.server";
import { clampEditTime, mergeFields, type FieldTimes } from "@/lib/sync/merge";

/**
 * Optional remote sync endpoint (Neon Postgres).
 *
 * The app is fully usable without it: when DATABASE_URL is not configured this
 * responds `{ configured: false }` and the client keeps everything local.
 * When someone is signed in, their account owns the rows instead of the device.
 */

const opSchema = z.union([
  z.object({
    kind: z.literal("upsert"),
    table: z.string().min(1).max(40),
    id: z.string().min(1).max(80),
    at: z.number().optional(),
    row: z.record(z.string(), z.unknown()),
  }),
  z.object({
    kind: z.literal("update"),
    table: z.string().min(1).max(40),
    id: z.string().min(1).max(80),
    at: z.number().optional(),
    patch: z.record(z.string(), z.unknown()),
  }),
  z.object({
    kind: z.literal("delete"),
    table: z.string().min(1).max(40),
    id: z.string().min(1).max(80),
  }),
]);

const bodySchema = z.object({
  accountId: z.string().min(1).max(80),
  deviceId: z.string().min(1).max(80),
  since: z.string().min(1).max(40).optional(),
  ops: z.array(opSchema).max(500).default([]),
});

const ALLOWED_TABLES = new Set([
  "profiles",
  "tasks",
  "goals",
  "subtasks",
  "deferral_logs",
  "achievements",
  "focus_sessions",
  "reminders",
  "squads",
]);

export const Route = createFileRoute("/api/public/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const sql = getSql();
        if (!sql) return Response.json({ configured: false });

        const parsed = bodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }
        const { deviceId, ops } = parsed.data;
        const since = parsed.data.since ?? "1970-01-01T00:00:00.000Z";

        try {
          await ensureSchema(sql);
          // A signed-in account always wins over the device-local sync key.
          const user = await getSessionUser(request);
          if (!user) {
            // A real account's rows are only reachable with that account's session,
            // never by sending its id as a plain sync key.
            const owned = (await sql`
              select 1 from ascend_users where id::text = ${parsed.data.accountId} limit 1`) as unknown[];
            if (owned.length > 0) {
              return Response.json({ error: "Please sign in again" }, { status: 401 });
            }
          }
          const accountId = user?.id ?? parsed.data.accountId;

          for (const op of ops) {
            if (!ALLOWED_TABLES.has(op.table)) continue;
            if (op.kind === "delete") {
              await sql`
                insert into ascend_rows (account_id, table_name, row_id, device_id, data, updated_at, deleted)
                values (${accountId}, ${op.table}, ${op.id}, ${deviceId}, '{}'::jsonb, now(), true)
                on conflict (account_id, table_name, row_id)
                do update set deleted = true, updated_at = now(), device_id = ${deviceId}`;
              continue;
            }
            const incoming = op.kind === "upsert" ? op.row : op.patch;
            const at = clampEditTime(op.at, Date.now());
            const existing = (await sql`
              select data, field_times from ascend_rows
              where account_id = ${accountId} and table_name = ${op.table} and row_id = ${op.id}
              limit 1`) as { data: Record<string, unknown>; field_times: FieldTimes | null }[];
            const merged = mergeFields(
              existing[0]?.data ?? {},
              existing[0]?.field_times ?? {},
              incoming,
              at,
            );
            await sql`
              insert into ascend_rows (account_id, table_name, row_id, device_id, data, field_times, updated_at, deleted)
              values (${accountId}, ${op.table}, ${op.id}, ${deviceId}, ${JSON.stringify(merged.data)}::jsonb,
                      ${JSON.stringify(merged.fieldTimes)}::jsonb, now(), false)
              on conflict (account_id, table_name, row_id)
              do update set data = excluded.data,
                            field_times = excluded.field_times,
                            updated_at = now(),
                            deleted = false,
                            device_id = ${deviceId}`;
          }

          // Cursor comes from the database clock, taken before reading, with a small
          // overlap so writes committing at the same moment are never skipped.
          const clock = (await sql`
            select (now() - interval '5 seconds') as cursor`) as { cursor: string | Date }[];
          const cursor = clock[0]?.cursor;
          const now = cursor ? new Date(cursor).toISOString() : new Date().toISOString();

          const changes = await sql`
            select table_name, row_id, data, updated_at, deleted
            from ascend_rows
            where account_id = ${accountId} and updated_at > ${since}
            order by updated_at asc
            limit 5000`;

          return Response.json({ configured: true, now, changes });
        } catch (err) {
          console.error("[sync] remote database error", err);
          return Response.json({ error: "Sync unavailable" }, { status: 503 });
        }
      },
    },
  },
});
