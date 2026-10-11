import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ensureSchema, getSql } from "@/lib/db/neon.server";

/** Called by the service worker when a push arrives: returns the reminders just sent
 *  to this subscription. The endpoint URL is private to the browser that owns it. */

const bodySchema = z.object({ endpoint: z.string().url().max(1000) });

export const Route = createFileRoute("/api/public/push/pending")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const sql = getSql();
        if (!sql) return Response.json({ items: [] });
        const parsed = bodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
        try {
          await ensureSchema(sql);
          const items = await sql`
            update ascend_push_sent set shown = true
            where endpoint = ${parsed.data.endpoint}
              and shown = false
              and sent_at > now() - interval '30 minutes'
            returning reminder_id as id, label`;
          return Response.json({ items });
        } catch (err) {
          console.error("[push] pending failed", err);
          return Response.json({ items: [] }, { status: 503 });
        }
      },
    },
  },
});
