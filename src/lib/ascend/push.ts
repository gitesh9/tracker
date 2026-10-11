/** Background reminders on this device (Web Push). */
import { getAccountId } from "./identity";

export type PushState =
  | "unsupported" // browser has no push (or iPhone not installed to home screen)
  | "unavailable" // server has no push keys / database configured
  | "blocked" // notifications denied
  | "off"
  | "on";

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function keyToBytes(key: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (key.length % 4)) % 4);
  const raw = atob((key + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

async function serverKey(): Promise<string | null> {
  try {
    const res = await fetch("/api/public/push/subscribe");
    const json = (await res.json()) as { configured: boolean; publicKey: string | null };
    return json.configured ? json.publicKey : null;
  } catch {
    return null;
  }
}

export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  const reg = await registration();
  if (!reg) return "unsupported";
  const sub = await reg.pushManager.getSubscription().catch(() => null);
  if (sub) return "on";
  return (await serverKey()) ? "off" : "unavailable";
}

async function save(sub: PushSubscription): Promise<void> {
  const res = await fetch("/api/public/push/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      accountId: getAccountId(),
      endpoint: sub.endpoint,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
  });
  if (res.status === 401) throw new Error("Sign in again to turn on background reminders.");
  if (!res.ok) throw new Error("Could not reach the server. Try again in a moment.");
}

export async function enablePush(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "blocked" : "off";
  const key = await serverKey();
  if (!key) return "unavailable";
  const reg = await registration();
  if (!reg) return "unsupported";
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(key) }));
  await save(sub);
  // Make sure the reminders themselves are on the server.
  window.dispatchEvent(new CustomEvent("ascend:sync-now"));
  return "on";
}

export async function disablePush(): Promise<PushState> {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription().catch(() => null);
  if (sub) {
    await fetch("/api/public/push/subscribe", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => undefined);
    await sub.unsubscribe().catch(() => undefined);
  }
  return "off";
}

/** Keeps the server's copy of this device's subscription (account, time zone) fresh. */
export async function refreshPushSubscription(): Promise<void> {
  if (!pushSupported() || Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker.getRegistration("/").catch(() => undefined);
  const sub = await reg?.pushManager.getSubscription().catch(() => null);
  if (sub) await save(sub).catch(() => undefined);
}
