import { createFileRoute } from "@tanstack/react-router";
import { ensureSchema, getSql, publicUser, type RemoteUser } from "@/lib/db/neon.server";
import { cookieHeader, createSession, readCookieValue } from "@/lib/auth/session.server";
import {
  getCallbackUrl,
  renderAuthCompleteHtml,
  resolveOrigin,
  verifySignedOAuthState,
} from "@/lib/auth/oauth.server";

type IdTokenClaims = { sub?: string; email?: string; name?: string; picture?: string };

function decodeIdToken(idToken: string): IdTokenClaims {
  const payload = idToken.split(".")[1];
  if (!payload) return {};
  const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(json) as IdTokenClaims;
}

function fail(reason: string) {
  const html = renderAuthCompleteHtml(false, reason);
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export const Route = createFileRoute("/api/public/auth/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const clientId = process.env["GOOGLE_CLIENT_ID"];
        const clientSecret = process.env["GOOGLE_CLIENT_SECRET"];
        const sql = getSql();

        if (!code || !state) return fail("google_state");
        if (!clientId || !clientSecret || !sql) return fail("google_unavailable");

        // Validate state: first via cryptographically signed HMAC token, fallback to cookie
        let verifiedOrigin: string | null = null;
        let verifiedRedirectUri: string | null = null;
        const verified = await verifySignedOAuthState(state, clientSecret);
        if (verified) {
          verifiedOrigin = verified.origin;
          verifiedRedirectUri = verified.redirectUri ?? null;
        } else {
          const expected = readCookieValue(request, "ascend_oauth_state");
          if (!expected || state !== expected) {
            return fail("google_state");
          }
        }

        const origin = verifiedOrigin || resolveOrigin(request);
        const callbackUrl =
          verifiedRedirectUri || process.env["GOOGLE_REDIRECT_URI"] || getCallbackUrl(origin);

        try {
          const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              code,
              client_id: clientId,
              client_secret: clientSecret,
              redirect_uri: callbackUrl,
              grant_type: "authorization_code",
            }),
          });

          if (!tokenRes.ok) {
            const errText = await tokenRes.text();
            console.error("[auth] google token exchange failed", errText);
            return fail("google_failed");
          }

          const token = (await tokenRes.json()) as { id_token?: string };
          const claims = token.id_token ? decodeIdToken(token.id_token) : {};
          const email = claims.email?.toLowerCase();
          if (!email || !claims.sub) return fail("google_failed");

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

          const isHttps = origin.startsWith("https:");
          const cookiePolicy = isHttps ? "SameSite=None; Secure; Partitioned" : "SameSite=Lax";

          const headers = new Headers();
          headers.set("content-type", "text/html; charset=utf-8");
          headers.append("set-cookie", cookieHeader(request, session));
          headers.append(
            "set-cookie",
            `ascend_oauth_state=; Path=/; HttpOnly; ${cookiePolicy}; Max-Age=0`,
          );

          const html = renderAuthCompleteHtml(true, email);
          return new Response(html, { status: 200, headers });
        } catch (err) {
          console.error("[auth] google sign-in failed", err);
          return fail("google_failed");
        }
      },
    },
  },
});
