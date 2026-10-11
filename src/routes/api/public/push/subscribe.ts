import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ensureSchema, getSql } from "@/lib/db/neon.server";
import { getSessionUser } from "@/lib/auth/session.server";
import { getVapidConfig } from "@/lib/push/webpush.server";

/** Saves (POST) or removes (DELETE) this device's background-reminder subscription.
 *  GET returns the public key the browser needs to subscribe. */

const bodySchema = z.object({
  accountId: z.string().min(1).max(80),
  endpoint: z.string().url().max(1000).startsWith("https://"),
  timezone: z.string().min(1).max(64).optional(),
});

export const Route = createFileRoute("/api/public/push/subscribe")({
  server: {
    handlers: {
      GET: async () => {
        const vapid = getVapidConfig();
        return Response.json({
          configured: Boolean(vapid && getSql()),
          publicKey: vapid?.publicKey ?? null,
        });
      },
      POST: async ({ request }) => {
        const sql = getSql();
        if (!sql || !getVapidConfig()) return Response.json({ configured: false });
        const parsed = bodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
        try {
          await ensureSchema(sql);
          const user = await getSessionUser(request);
          if (!user) {
            const owned = (await sql`
              select 1 from ascend_users where id::text = ${parsed.data.accountId} limit 1`) as unknown[];
            if (owned.length > 0) {
              return Response.json({ error: "Please sign in again" }, { status: 401 });
            }
          }
          const accountId = user?.id ?? parsed.data.accountId;
          const tz = parsed.data.timezone ?? "UTC";
          await sql`
            insert into ascend_push_subscriptions (endpoint, account_id, timezone)
            values (${parsed.data.endpoint}, ${accountId}, ${tz})
            on conflict (endpoint) do update
              set account_id = excluded.account_id, timezone = excluded.timezone, updated_at = now()`;
          return Response.json({ configured: true, ok: true });
        } catch (err) {
          console.error("[push] subscribe failed", err);
          return Response.json({ error: "Unavailable" }, { status: 503 });
        }
      },
      DELETE: async ({ request }) => {
        const sql = getSql();
        if (!sql) return Response.json({ configured: false });
        const parsed = bodySchema
          .pick({ endpoint: true })
          .safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
        try {
          await ensureSchema(sql);
          await sql`delete from ascend_push_subscriptions where endpoint = ${parsed.data.endpoint}`;
          return Response.json({ ok: true });
        } catch (err) {
          console.error("[push] unsubscribe failed", err);
          return Response.json({ error: "Unavailable" }, { status: 503 });
        }
      },
    },
  },
});
