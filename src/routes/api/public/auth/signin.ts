import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ensureSchema, getSql, publicUser, type RemoteUser } from "@/lib/db/neon.server";
import { verifyPassword } from "@/lib/auth/password.server";
import { cookieHeader, createSession } from "@/lib/auth/session.server";

const schema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
});

export const Route = createFileRoute("/api/public/auth/signin")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const sql = getSql();
        if (!sql) return Response.json({ error: "Accounts are not set up yet." }, { status: 503 });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json({ error: "Enter your email and password." }, { status: 400 });
        }
        const email = parsed.data.email.trim().toLowerCase();

        try {
          await ensureSchema(sql);
          const rows = (await sql`
            select id, email, display_name, avatar_url, password_hash
            from ascend_users where email = ${email} limit 1`) as (RemoteUser & {
            password_hash: string | null;
          })[];
          const row = rows[0];
          if (!row || !(await verifyPassword(parsed.data.password, row.password_hash))) {
            return Response.json({ error: "Email or password is incorrect." }, { status: 401 });
          }
          const user = publicUser(row);
          const token = await createSession(user.id);
          return Response.json(
            { user },
            { headers: { "set-cookie": cookieHeader(request, token) } },
          );
        } catch (err) {
          console.error("[auth] signin failed", err);
          return Response.json({ error: "Could not sign in right now." }, { status: 503 });
        }
      },
    },
  },
});
