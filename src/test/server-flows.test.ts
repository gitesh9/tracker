/**
 * End-to-end checks of the server: sign-up, signing in on a second device, syncing
 * history between devices, squads shared between two people, and background
 * reminders. The online database is replaced by an in-memory Postgres (PGlite).
 */
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@neondatabase/serverless", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite();
  const neon = () => async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.reduce((acc, part, i) => acc + (i > 0 ? `$${i}` : "") + part, "");
    const res = await db.query(text, values);
    return res.rows;
  };
  return { neon };
});

process.env["DATABASE_URL"] = "postgres://test";
process.env["CRON_SECRET"] = "test-cron-secret-1234567890";

type Handler = (ctx: { request: Request }) => Promise<Response> | Response;
const ROUTES: Record<string, () => Promise<unknown>> = {
  "auth/signup": () => import("../routes/api/public/auth/signup"),
  "auth/signin": () => import("../routes/api/public/auth/signin"),
  "auth/me": () => import("../routes/api/public/auth/me"),
  sync: () => import("../routes/api/public/sync"),
  squads: () => import("../routes/api/public/squads"),
  "push/subscribe": () => import("../routes/api/public/push/subscribe"),
  "push/dispatch": () => import("../routes/api/public/push/dispatch"),
  "push/pending": () => import("../routes/api/public/push/pending"),
};
async function handler(path: string, method = "POST"): Promise<Handler> {
  const mod = (await ROUTES[path]!()) as {
    Route: { options: { server: { handlers: Record<string, Handler> } } };
  };
  return mod.Route.options.server.handlers[method]!;
}

function req(body: unknown, cookie?: string, headers: Record<string, string> = {}) {
  return new Request("https://ascend.test/api", {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...headers },
    body: JSON.stringify(body),
  });
}

const cookieOf = (res: Response) => (res.headers.get("set-cookie") ?? "").split(";")[0]!;

let alice = "";
let aliceId = "";
let bob = "";
let bobId = "";

beforeAll(async () => {
  const signup = await handler("auth/signup");
  const a = await signup({ request: req({ email: "alice@test.dev", password: "password123", name: "Alice" }) });
  expect(a.status).toBe(200);
  alice = cookieOf(a);
  aliceId = ((await a.json()) as { user: { id: string } }).user.id;
  const b = await signup({ request: req({ email: "bob@test.dev", password: "password123", name: "Bob" }) });
  bob = cookieOf(b);
  bobId = ((await b.json()) as { user: { id: string } }).user.id;
});

describe("sign-in", () => {
  it("signs in on a second device and recognises the session", async () => {
    const signin = await handler("auth/signin");
    const res = await signin({ request: req({ email: "alice@test.dev", password: "password123" }) });
    expect(res.status).toBe(200);
    const me = await handler("auth/me", "GET");
    const status = (await (
      await me({ request: new Request("https://ascend.test/me", { headers: { cookie: cookieOf(res) } }) })
    ).json()) as { user: { email: string } | null };
    expect(status.user?.email).toBe("alice@test.dev");
  });

  it("rejects a wrong password", async () => {
    const signin = await handler("auth/signin");
    const res = await signin({ request: req({ email: "alice@test.dev", password: "nope-nope-nope" }) });
    expect(res.status).toBe(401);
  });
});

describe("sync across devices", () => {
  it("history made on one device reaches the other", async () => {
    const sync = await handler("sync");
    const push = await sync({
      request: req(
        {
          accountId: aliceId,
          deviceId: "laptop",
          ops: [
            { kind: "upsert", table: "tasks", id: "t1", row: { id: "t1", title: "Run", notes: "" }, at: 1000 },
            { kind: "upsert", table: "focus_sessions", id: "f1", row: { id: "f1", minutes: 25 }, at: 1000 },
          ],
        },
        alice,
      ),
    });
    expect(push.status).toBe(200);

    const pull = await sync({ request: req({ accountId: aliceId, deviceId: "phone", ops: [] }, alice) });
    const body = (await pull.json()) as { changes: { table_name: string; row_id: string }[] };
    expect(body.changes.map((c) => `${c.table_name}:${c.row_id}`).sort()).toEqual([
      "focus_sessions:f1",
      "tasks:t1",
    ]);
  });

  it("edits to different fields on two devices both survive", async () => {
    const sync = await handler("sync");
    await sync({ request: req({ accountId: aliceId, deviceId: "phone", ops: [{ kind: "update", table: "tasks", id: "t1", patch: { title: "Run 5k" }, at: 2000 }] }, alice) });
    await sync({ request: req({ accountId: aliceId, deviceId: "laptop", ops: [{ kind: "update", table: "tasks", id: "t1", patch: { notes: "easy pace" }, at: 2001 }] }, alice) });
    const pull = await sync({ request: req({ accountId: aliceId, deviceId: "x", ops: [] }, alice) });
    const body = (await pull.json()) as { changes: { row_id: string; data: Record<string, unknown> }[] };
    expect(body.changes.find((c) => c.row_id === "t1")?.data).toMatchObject({ title: "Run 5k", notes: "easy pace" });
  });

  it("an account's rows can't be read with its id alone", async () => {
    const sync = await handler("sync");
    const res = await sync({ request: req({ accountId: aliceId, deviceId: "thief", ops: [] }) });
    expect(res.status).toBe(401);
  });
});

describe("squads with other people", () => {
  it("Bob joins Alice's squad with the invite code and both see each other's changes", async () => {
    const squads = await handler("squads");
    const created = await squads({
      request: req(
        { ops: [{ opId: "o1", kind: "create", squadId: "s1", name: "Climbers", description: "", code: "SQUAD-TEST1234" }] },
        alice,
      ),
    });
    const code = ((await created.json()) as { squads: { code: string }[] }).squads[0]!.code;

    const joined = await squads({ request: req({ ops: [{ opId: "o2", kind: "join", code: code.toLowerCase() }] }, bob) });
    const jb = (await joined.json()) as { results: { ok: boolean }[]; squads: { members: { id: string }[] }[] };
    expect(jb.results[0]?.ok).toBe(true);
    expect(jb.squads[0]?.members.map((m) => m.id).sort()).toEqual([aliceId, bobId].sort());

    await squads({ request: req({ ops: [{ opId: "o3", kind: "add_task", squadId: "s1", task: { id: "tt1", title: "Read", domain: "learning" } }] }, bob) });
    await squads({ request: req({ ops: [{ opId: "o4", kind: "set_task_done", squadId: "s1", taskId: "tt1", done: true }] }, alice) });
    // Retried request (dropped connection) must not double-apply.
    await squads({ request: req({ ops: [{ opId: "o5", kind: "cheer", squadId: "s1", memberId: bobId }] }, alice) });
    await squads({ request: req({ ops: [{ opId: "o5", kind: "cheer", squadId: "s1", memberId: bobId }] }, alice) });

    const bobView = (await (await squads({ request: req({ ops: [] }, bob) })).json()) as {
      squads: { tasks: { id: string; isCompleted: boolean; completedBy?: string }[]; members: { id: string; cheersReceived: number }[] }[];
    };
    expect(bobView.squads[0]?.tasks[0]).toMatchObject({ id: "tt1", isCompleted: true, completedBy: "Alice" });
    expect(bobView.squads[0]?.members.find((m) => m.id === bobId)?.cheersReceived).toBe(1);
  });

  it("outsiders can't change or see a squad, and wrong codes fail", async () => {
    const squads = await handler("squads");
    const signup = await handler("auth/signup");
    const eve = cookieOf(await signup({ request: req({ email: "eve@test.dev", password: "password123" }) }));
    const res = (await (
      await squads({ request: req({ ops: [{ opId: "e1", kind: "add_task", squadId: "s1", task: { id: "z", title: "x", domain: "focus" } }, { opId: "e2", kind: "join", code: "SQUAD-WRONG" }] }, eve) })
    ).json()) as { results: { ok: boolean; error?: string }[]; squads: unknown[] };
    expect(res.results.map((r) => r.error)).toEqual(["forbidden", "not_found"]);
    expect(res.squads).toEqual([]);
    expect((await squads({ request: req({ ops: [] }) })).status).toBe(401);
  });
});

describe("background reminders", () => {
  it("sends each due reminder once and hands the text to the device", async () => {
    // Real VAPID keys so signing runs exactly as in production.
    const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"])) as CryptoKeyPair;
    const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
    const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
    process.env["VAPID_PUBLIC_KEY"] = Buffer.from(raw).toString("base64url");
    process.env["VAPID_PRIVATE_KEY"] = jwk.d!;

    const now = new Date();
    const hhmm = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}:00`;
    const sync = await handler("sync");
    await sync({ request: req({ accountId: aliceId, deviceId: "phone", ops: [{ kind: "upsert", table: "reminders", id: "r1", row: { id: "r1", label: "Evening review", remind_at: hhmm, is_enabled: true }, at: 3000 }] }, alice) });

    const endpoint = "https://fcm.googleapis.com/fcm/send/abc";
    const subscribe = await handler("push/subscribe");
    expect((await subscribe({ request: req({ accountId: aliceId, endpoint, timezone: "UTC" }, alice) })).status).toBe(200);

    const sent: string[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
      sent.push(String(url));
      expect(String((init?.headers as Record<string, string>)["Authorization"])).toMatch(/^vapid t=.+, k=/);
      return new Response(null, { status: 201 });
    }) as typeof fetch;
    try {
      const dispatch = await handler("push/dispatch");
      expect((await dispatch({ request: req({}) })).status).toBe(401);
      const auth = { authorization: "Bearer test-cron-secret-1234567890" };
      expect(await (await dispatch({ request: req({}, undefined, auth) })).json()).toMatchObject({ sent: 1 });
      expect(await (await dispatch({ request: req({}, undefined, auth) })).json()).toMatchObject({ sent: 0 });
    } finally {
      globalThis.fetch = realFetch;
    }
    expect(sent).toEqual([endpoint]);

    const pending = await handler("push/pending");
    const items = (await (await pending({ request: req({ endpoint }) })).json()) as { items: { label: string }[] };
    expect(items.items.map((i) => i.label)).toEqual(["Evening review"]);
  });
});
