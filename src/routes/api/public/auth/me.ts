import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db/neon.server";
import { getSessionUser } from "@/lib/auth/session.server";

export const Route = createFileRoute("/api/public/auth/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const configured = Boolean(getSql());
        const googleClientId = process.env["GOOGLE_CLIENT_ID"] ?? null;
        const googleEnabled = Boolean(googleClientId && process.env["GOOGLE_CLIENT_SECRET"]);
        try {
          const user = configured ? await getSessionUser(request) : null;
          return Response.json(
            { configured, googleEnabled, googleClientId, user },
            { headers: { "cache-control": "no-store" } },
          );
        } catch (err) {
          console.error("[auth] session lookup failed", err);
          return Response.json({ configured, googleEnabled, googleClientId, user: null });
        }
      },
    },
  },
});
