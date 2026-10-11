import { createFileRoute } from "@tanstack/react-router";
import { ensureSchema, getSql, publicUser, type RemoteUser } from "@/lib/db/neon.server";
import { cookieHeader, createSession } from "@/lib/auth/session.server";

type IdTokenClaims = { sub?: string; email?: string; name?: string; picture?: string };

function decodeIdToken(idToken: string): IdTokenClaims {
  const payload = idToken.split(".")[1];
  if (!payload) return {};
  const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(json) as IdTokenClaims;
}

export const Route = createFileRoute("/api/public/auth/google/code")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // CSRF check recommended by Google for GIS Popup Code flow:
        // Must contain X-Requested-With header
        const xRequestedWith = request.headers.get("x-requested-with");
        if (!xRequestedWith || xRequestedWith.toLowerCase() !== "xmlhttprequest") {
          return Response.json({ error: "Invalid CSRF header" }, { status: 403 });
        }

        const clientId = process.env["GOOGLE_CLIENT_ID"];
        const clientSecret = process.env["GOOGLE_CLIENT_SECRET"];
        const sql = getSql();

        if (!clientId || !clientSecret || !sql) {
          return Response.json(
            { error: "Google authentication is not configured on this server." },
            { status: 503 },
          );
        }

        let body: { code?: string; redirect_uri?: string } = {};
        try {
          body = (await request.json()) as { code?: string; redirect_uri?: string };
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const { code, redirect_uri } = body;
        if (!code || typeof code !== "string") {
          return Response.json({ error: "Missing authorization code" }, { status: 400 });
        }

        try {
          // When using Google Identity Services (GIS) initCodeClient in popup mode,
          // Google requires redirect_uri: 'postmessage'
          const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              code,
              client_id: clientId,
              client_secret: clientSecret,
              redirect_uri: redirect_uri || "postmessage",
              grant_type: "authorization_code",
            }),
          });

          if (!tokenRes.ok) {
            const errText = await tokenRes.text();
            console.error("[auth] google code exchange failed:", errText);
            return Response.json(
              { error: "Failed to exchange authorization code with Google." },
              { status: 400 },
            );
          }

          const token = (await tokenRes.json()) as { id_token?: string; access_token?: string };
          let claims: IdTokenClaims = token.id_token ? decodeIdToken(token.id_token) : {};

          // If id_token claims don't have email/sub, fetch from userinfo endpoint
          if (!claims.email && token.access_token) {
            const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
              headers: { Authorization: `Bearer ${token.access_token}` },
            });
            if (userinfoRes.ok) {
              claims = (await userinfoRes.json()) as IdTokenClaims;
            }
          }

          const email = claims.email?.toLowerCase();
          if (!email || !claims.sub) {
            return Response.json(
              { error: "Could not retrieve user info from Google." },
              { status: 400 },
            );
          }

          await ensureSchema(sql);
          const rows = (await sql`
            insert into ascend_users (email, display_name, avatar_url, google_sub)
            values (${email}, ${claims.name ?? null}, ${claims.picture ?? null}, ${claims.sub})
            on conflict (email) do update
              set google_sub = excluded.google_sub,
                  display_name = coalesce(ascend_users.display_name, excluded.display_name),
                  avatar_url = coalesce(excluded.avatar_url, ascend_users.avatar_url)
            returning id, email, display_name, avatar_url`) as RemoteUser[];

          const user = publicUser(rows[0]!);
          const session = await createSession(user.id);

          const headers = new Headers();
          headers.set("content-type", "application/json");
          headers.append("set-cookie", cookieHeader(request, session));

          return new Response(JSON.stringify({ ok: true, user }), {
            status: 200,
            headers,
          });
        } catch (err) {
          console.error("[auth] google sign-in with code failed:", err);
          return Response.json(
            { error: "Internal server error during Google sign-in." },
            { status: 500 },
          );
        }
      },
    },
  },
});
