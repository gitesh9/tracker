/**
 * Minimal Web Push sender for edge runtimes (Web Crypto only, no Node APIs).
 *
 * Pushes are sent without a payload, so no message encryption is needed: the
 * service worker wakes up and fetches what to show from /api/public/push/pending.
 */

function b64urlToBytes(value: string): Uint8Array {
  const pad = "=".repeat((4 - (value.length % 4)) % 4);
  const raw = atob((value + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function bytesToB64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const textB64url = (text: string) => bytesToB64url(new TextEncoder().encode(text));

export type VapidConfig = { publicKey: string; privateKey: string; subject: string };

export function getVapidConfig(): VapidConfig | null {
  const publicKey = process.env["VAPID_PUBLIC_KEY"];
  const privateKey = process.env["VAPID_PRIVATE_KEY"];
  if (!publicKey || !privateKey) return null;
  return {
    publicKey,
    privateKey,
    subject: process.env["VAPID_SUBJECT"] || "mailto:reminders@ascend.app",
  };
}

const keyCache = new Map<string, Promise<CryptoKey>>();

function signingKey(config: VapidConfig): Promise<CryptoKey> {
  let key = keyCache.get(config.privateKey);
  if (!key) {
    const pub = b64urlToBytes(config.publicKey); // 0x04 || x(32) || y(32)
    key = crypto.subtle.importKey(
      "jwk",
      {
        kty: "EC",
        crv: "P-256",
        x: bytesToB64url(pub.slice(1, 33)),
        y: bytesToB64url(pub.slice(33, 65)),
        d: config.privateKey,
        ext: true,
      },
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"],
    );
    keyCache.set(config.privateKey, key);
  }
  return key;
}

async function vapidJwt(audience: string, config: VapidConfig): Promise<string> {
  const header = textB64url(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const claims = textB64url(
    JSON.stringify({
      aud: audience,
      exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
      sub: config.subject,
    }),
  );
  const unsigned = `${header}.${claims}`;
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    await signingKey(config),
    new TextEncoder().encode(unsigned),
  );
  return `${unsigned}.${bytesToB64url(new Uint8Array(signature))}`;
}

/** Returns the push service's status. 404/410 mean the subscription is gone. */
export async function sendEmptyPush(endpoint: string, config: VapidConfig): Promise<number> {
  const jwt = await vapidJwt(new URL(endpoint).origin, config);
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${jwt}, k=${config.publicKey}`,
      TTL: "600",
      Urgency: "high",
      "Content-Length": "0",
    },
  });
  return res.status;
}

/** Local date ("YYYY-MM-DD") and minutes since midnight in a time zone. */
export function localClock(timeZone: string, at = new Date()): { day: string; minutes: number } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(at);
  } catch {
    return localClock("UTC", at);
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return {
    day: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

/** Whether a reminder at "HH:MM[:SS]" is due now, allowing a catch-up window so a
 *  scheduler that runs every few minutes still delivers it once. */
export function isDue(remindAt: string, nowMinutes: number, windowMinutes = 10): boolean {
  const [h, m] = String(remindAt || "").split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return false;
  const target = (h ?? 0) * 60 + (m ?? 0);
  return nowMinutes >= target && nowMinutes < target + windowMinutes;
}
