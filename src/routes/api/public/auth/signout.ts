import { createFileRoute } from "@tanstack/react-router";
import {
  SESSION_COOKIE,
  cookieHeader,
  destroySession,
  readCookieValue,
} from "@/lib/auth/session.server";

export const Route = createFileRoute("/api/public/auth/signout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = readCookieValue(request, SESSION_COOKIE);
        if (token) {
          try {
            await destroySession(token);
          } catch (err) {
            console.error("[auth] signout cleanup failed", err);
          }
        }
        return Response.json(
          { ok: true },
          { headers: { "set-cookie": cookieHeader(request, null) } },
        );
      },
    },
  },
});
