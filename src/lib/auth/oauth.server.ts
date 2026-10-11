/**
 * Server-side OAuth helpers for Google authentication in AI Studio preview & production.
 */

export function resolveOrigin(request: Request, clientOrigin?: string | null): string {
  // 1. Client-provided origin (e.g., from window.location.origin)
  if (clientOrigin && typeof clientOrigin === "string") {
    try {
      const u = new URL(clientOrigin);
      const isLocal = u.hostname === "localhost" || u.hostname === "127.0.0.1";
      if (isLocal) {
        return u.origin;
      }
      if (u.protocol === "https:" || u.protocol === "http:") {
        return `https://${u.host}`;
      }
    } catch {
      // Ignore invalid URL and continue to headers
    }
  }

  // 2. Forwarded Host from Cloud Run / reverse proxy
  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (forwardedHost) {
    const cleanHost = forwardedHost.split(",")[0]!.trim();
    const isLocal = cleanHost.startsWith("localhost") || cleanHost.startsWith("127.0.0.1");
    if (isLocal) {
      const proto = request.headers.get("x-forwarded-proto") || "http";
      return `${proto}://${cleanHost}`;
    }
    // Any non-localhost domain on Cloud Run / production must be https
    return `https://${cleanHost}`;
  }

  // 3. Fallback to runtime APP_URL environment variable
  if (process.env["APP_URL"]) {
    return process.env["APP_URL"].replace(/\/$/, "");
  }

  // 4. Default from request.url
  const reqUrl = new URL(request.url);
  const isLocal = reqUrl.hostname === "localhost" || reqUrl.hostname === "127.0.0.1";
  const proto = isLocal ? "http" : "https";
  return `${proto}://${reqUrl.host}`;
}

export function getCallbackUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/public/auth/google/callback`;
}

export function resolveRedirectUri(request: Request, clientOrigin?: string | null): string {
  if (process.env["GOOGLE_REDIRECT_URI"]) {
    return process.env["GOOGLE_REDIRECT_URI"];
  }
  const origin = resolveOrigin(request, clientOrigin);
  return getCallbackUrl(origin);
}

export type SignedOAuthPayload = {
  origin: string;
  redirectUri?: string;
  nonce: string;
  ts: number;
};

export async function createSignedOAuthState(
  payload: SignedOAuthPayload,
  secret: string,
): Promise<string> {
  const jsonStr = JSON.stringify(payload);
  const dataB64 = Buffer.from(jsonStr, "utf-8").toString("base64url");
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(dataB64));
  const sigB64 = Buffer.from(sig).toString("base64url");
  return `${dataB64}.${sigB64}`;
}

export async function verifySignedOAuthState(
  stateStr: string,
  secret: string,
): Promise<SignedOAuthPayload | null> {
  try {
    const [dataB64, sigB64] = stateStr.split(".");
    if (!dataB64 || !sigB64) return null;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      Buffer.from(sigB64, "base64url"),
      enc.encode(dataB64),
    );
    if (!valid) return null;

    const payload = JSON.parse(Buffer.from(dataB64, "base64url").toString("utf-8"));
    if (typeof payload.ts !== "number" || typeof payload.origin !== "string") return null;
    // Expire state after 15 minutes
    if (Date.now() - payload.ts > 15 * 60 * 1000) return null;

    return payload as SignedOAuthPayload;
  } catch {
    return null;
  }
}

export function renderAuthCompleteHtml(success: boolean, reasonOrEmail: string): string {
  if (success) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Ascend — Sign-in Complete</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #09090b;
      color: #fafafa;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .card {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 12px;
      padding: 32px;
      max-width: 380px;
      width: 90%;
      text-align: center;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    }
    h2 { margin: 0 0 8px 0; font-size: 1.25rem; font-weight: 600; color: #10b981; }
    p { margin: 0; color: #a1a1aa; font-size: 0.875rem; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Signed in successfully</h2>
    <p>Returning to Ascend...</p>
  </div>
  <script>
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', provider: 'google' }, '*');
        setTimeout(() => window.close(), 600);
      } else {
        window.location.href = '/auth?google=1';
      }
    } catch (e) {
      window.location.href = '/auth?google=1';
    }
  </script>
</body>
</html>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Ascend — Sign-in Failed</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #09090b;
      color: #fafafa;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .card {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 12px;
      padding: 32px;
      max-width: 380px;
      width: 90%;
      text-align: center;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    }
    h2 { margin: 0 0 8px 0; font-size: 1.25rem; font-weight: 600; color: #ef4444; }
    p { margin: 0; color: #a1a1aa; font-size: 0.875rem; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Sign-in failed</h2>
    <p>Could not complete Google authentication (${reasonOrEmail}).</p>
  </div>
  <script>
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: '${reasonOrEmail}' }, '*');
        setTimeout(() => window.close(), 2000);
      } else {
        window.location.href = '/auth?error=${reasonOrEmail}';
      }
    } catch (e) {
      window.location.href = '/auth?error=${reasonOrEmail}';
    }
  </script>
</body>
</html>`;
}
