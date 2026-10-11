import { createFileRoute } from "@tanstack/react-router";
import { createSignedOAuthState, resolveOrigin, resolveRedirectUri } from "@/lib/auth/oauth.server";

export const Route = createFileRoute("/api/public/auth/google/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const clientId = process.env["GOOGLE_CLIENT_ID"];
        const clientSecret = process.env["GOOGLE_CLIENT_SECRET"];

        const url = new URL(request.url);
        const wantsJson =
          url.searchParams.get("mode") === "json" ||
          request.headers.get("accept")?.includes("application/json");

        if (!clientId || !clientSecret) {
          if (wantsJson) {
            return Response.json(
              { error: "google_unavailable", message: "Google sign-in is not configured." },
              { status: 503 },
            );
          }
          return Response.redirect(new URL("/auth?error=google_unavailable", request.url), 302);
        }

        const clientOrigin = url.searchParams.get("origin");
        const origin = resolveOrigin(request, clientOrigin);
        const redirectUri = resolveRedirectUri(request, clientOrigin);

        const nonce = crypto.randomUUID();
        const state = await createSignedOAuthState(
          { origin, redirectUri, nonce, ts: Date.now() },
          clientSecret,
        );

        const authorize = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        authorize.searchParams.set("client_id", clientId);
        authorize.searchParams.set("redirect_uri", redirectUri);
        authorize.searchParams.set("response_type", "code");
        authorize.searchParams.set("scope", "openid email profile");
        authorize.searchParams.set("state", state);
        authorize.searchParams.set("prompt", "select_account");

        const isHttps = origin.startsWith("https:");
        const cookiePolicy = isHttps ? "SameSite=None; Secure; Partitioned" : "SameSite=Lax";

        const headers = new Headers();
        headers.append(
          "set-cookie",
          `ascend_oauth_state=${state}; Path=/; HttpOnly; ${cookiePolicy}; Max-Age=900`,
        );

        if (wantsJson) {
          headers.set("content-type", "application/json");
          return new Response(JSON.stringify({ url: authorize.toString(), redirectUri }), {
            status: 200,
            headers,
          });
        }

        headers.set("location", authorize.toString());
        return new Response(null, {
          status: 302,
          headers,
        });
      },
    },
  },
});
