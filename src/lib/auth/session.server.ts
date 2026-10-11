/** Sign-in sessions: an opaque cookie token, stored hashed in the remote database. */
import { ensureSchema, getSql, publicUser, type RemoteUser } from "@/lib/db/neon.server";
import { resolveOrigin } from "@/lib/auth/oauth.server";

export const SESSION_COOKIE = "ascend_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function cookieHeader(request: Request, token: string | null): string {
  const origin = resolveOrigin(request);
  const isHttps = origin.startsWith("https:");
  const cookiePolicy = isHttps ? "SameSite=None; Secure; Partitioned" : "SameSite=Lax";

  if (!token) return `${SESSION_COOKIE}=; Path=/; HttpOnly; ${cookiePolicy}; Max-Age=0`;
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; ${cookiePolicy}; Max-Age=${MAX_AGE}`;
}

export function readCookieValue(request: Request, name: string): string | null {
  return readCookie(request, name);
}

export async function createSession(userId: string): Promise<string> {
  const sql = getSql();
  if (!sql) throw new Error("No remote database configured");
  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
  const expires = new Date(Date.now() + MAX_AGE * 1000).toISOString();
  await sql`insert into ascend_sessions (token_hash, user_id, expires_at)
            values (${await sha256(token)}, ${userId}, ${expires})`;
  return token;
}

export async function destroySession(token: string): Promise<void> {
  const sql = getSql();
  if (!sql) return;
  await sql`delete from ascend_sessions where token_hash = ${await sha256(token)}`;
}

/** The signed-in user for this request, or null when signed out / no remote database. */
export async function getSessionUser(request: Request) {
  const sql = getSql();
  if (!sql) return null;
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  await ensureSchema(sql);
  const rows = (await sql`
    select u.id, u.email, u.display_name, u.avatar_url
    from ascend_sessions s
    join ascend_users u on u.id = s.user_id
    where s.token_hash = ${await sha256(token)} and s.expires_at > now()
    limit 1`) as RemoteUser[];
  const row = rows[0];
  return row ? publicUser(row) : null;
}
