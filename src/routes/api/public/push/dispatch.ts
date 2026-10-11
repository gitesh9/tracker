import { createFileRoute } from "@tanstack/react-router";
import { ensureSchema, getSql } from "@/lib/db/neon.server";
import { getVapidConfig, isDue, localClock, sendEmptyPush } from "@/lib/push/webpush.server";

/**
 * Sends background reminders. Call it every 1–5 minutes from a scheduler with
 * `Authorization: Bearer <CRON_SECRET>`. Safe to call repeatedly: each reminder is
 * sent at most once per device per day.
 */

function authorised(request: Request): boolean {
  const secret = process.env["CRON_SECRET"];
  if (!secret || secret.length < 16) return false;
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (given.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i++) diff |= given.charCodeAt(i) ^ secret.charCodeAt(i);
  return diff === 0;
}

type Sub = { endpoint: string; account_id: string; timezone: string };
type ReminderRow = { account_id: string; row_id: string; data: Record<string, unknown> };

async function dispatch(request: Request): Promise<Response> {
  if (!authorised(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const sql = getSql();
  const vapid = getVapidConfig();
  if (!sql || !vapid) return Response.json({ configured: false });

  try {
    await ensureSchema(sql);
    const subs = (await sql`
      select endpoint, account_id, timezone from ascend_push_subscriptions
      limit 5000`) as Sub[];
    if (subs.length === 0) return Response.json({ sent: 0 });

    const accounts = [...new Set(subs.map((s) => s.account_id))];
    const reminders = (await sql`
      select account_id, row_id, data from ascend_rows
      where table_name = 'reminders' and deleted = false
        and account_id = any(${accounts})
        and coalesce((data->>'is_enabled')::boolean, true) = true`) as ReminderRow[];

    const byAccount = new Map<string, ReminderRow[]>();
    for (const r of reminders) {
      const list = byAccount.get(r.account_id) ?? [];
      list.push(r);
      byAccount.set(r.account_id, list);
    }

    let sent = 0;
    let removed = 0;
    for (const sub of subs) {
      const { day, minutes } = localClock(sub.timezone);
      const due = (byAccount.get(sub.account_id) ?? []).filter((r) =>
        isDue(String(r.data["remind_at"] ?? ""), minutes),
      );
      let claimed = 0;
      for (const r of due) {
        const label = String(r.data["label"] ?? "Reminder").slice(0, 200);
        const rows = (await sql`
          insert into ascend_push_sent (endpoint, reminder_id, day, label)
          values (${sub.endpoint}, ${r.row_id}, ${day}, ${label})
          on conflict do nothing
          returning 1`) as unknown[];
        claimed += rows.length;
      }
      if (claimed === 0) continue;
      try {
        const status = await sendEmptyPush(sub.endpoint, vapid);
        if (status === 404 || status === 410) {
          await sql`delete from ascend_push_subscriptions where endpoint = ${sub.endpoint}`;
          removed++;
        } else if (status >= 200 && status < 300) {
          sent += claimed;
        } else {
          console.warn("[push] push service answered", status);
        }
      } catch (err) {
        console.warn("[push] send failed", err);
      }
    }
    await sql`delete from ascend_push_sent where sent_at < now() - interval '3 days'`;
    return Response.json({ sent, removed });
  } catch (err) {
    console.error("[push] dispatch failed", err);
    return Response.json({ error: "Unavailable" }, { status: 503 });
  }
}

export const Route = createFileRoute("/api/public/push/dispatch")({
  server: {
    handlers: {
      POST: ({ request }) => dispatch(request),
      GET: ({ request }) => dispatch(request),
    },
  },
});
