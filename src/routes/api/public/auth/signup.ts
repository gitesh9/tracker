import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ensureSchema, getSql, publicUser, type RemoteUser } from "@/lib/db/neon.server";
import { hashPassword } from "@/lib/auth/password.server";
import { cookieHeader, createSession } from "@/lib/auth/session.server";

const schema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
  name: z.string().max(80).optional(),
});

export const Route = createFileRoute("/api/public/auth/signup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const sql = getSql();
        if (!sql) return Response.json({ error: "Accounts are not set up yet." }, { status: 503 });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json(
            { error: "Enter a valid email and a password of at least 8 characters." },
            { status: 400 },
          );
        }
        const email = parsed.data.email.trim().toLowerCase();

        try {
          await ensureSchema(sql);
          const existing = (await sql`select id from ascend_users where email = ${email}`) as {
            id: string;
          }[];
          if (existing.length > 0) {
            return Response.json({ error: "That email already has an account." }, { status: 409 });
          }
          const rows = (await sql`
            insert into ascend_users (email, password_hash, display_name)
            values (${email}, ${await hashPassword(parsed.data.password)}, ${parsed.data.name ?? null})
            returning id, email, display_name, avatar_url`) as RemoteUser[];
          const user = publicUser(rows[0]!);
          const token = await createSession(user.id);
          return Response.json(
            { user },
            { headers: { "set-cookie": cookieHeader(request, token) } },
          );
        } catch (err) {
          console.error("[auth] signup failed", err);
          return Response.json({ error: "Could not create the account." }, { status: 503 });
        }
      },
    },
  },
});
