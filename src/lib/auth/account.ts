/**
 * Account sign-in (browser side).
 *
 * Signing in needs a connection; everything else in Ascend does not. The signed-in
 * account is cached on the device so the app still knows who you are while offline,
 * and the account id becomes the sync identity so local data lands in the right place.
 */
import { setAccountId } from "@/lib/ascend/identity";

export type Account = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
};

export type AuthStatus = {
  configured: boolean;
  googleEnabled: boolean;
  googleClientId?: string | null;
  user: Account | null;
};

const CACHE_KEY = "ascend.account.user";

export function cachedAccount(): Account | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Account) : null;
  } catch {
    return null;
  }
}

function cache(user: Account | null) {
  if (typeof window === "undefined") return;
  try {
    if (user) window.localStorage.setItem(CACHE_KEY, JSON.stringify(user));
    else window.localStorage.removeItem(CACHE_KEY);
  } catch {
    /* storage unavailable — the session still works for this visit */
  }
}

/** Ties this device's data to the account so it syncs to the right rows. */
export function adoptAccount(user: Account) {
  setAccountId(user.id);
  cache(user);
}

async function post(path: string, body?: unknown) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body ?? {}),
  });
  const data = (await res.json().catch(() => ({}))) as { user?: Account; error?: string };
  if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
  return data;
}

export async function fetchAuthStatus(): Promise<AuthStatus> {
  const res = await fetch("/api/public/auth/me", { credentials: "same-origin" });
  if (!res.ok) throw new Error("Could not check your sign-in.");
  const status = (await res.json()) as AuthStatus;
  if (status.user) adoptAccount(status.user);
  return status;
}

export async function signIn(email: string, password: string): Promise<Account> {
  const { user } = await post("/api/public/auth/signin", { email, password });
  if (!user) throw new Error("Could not sign in right now.");
  adoptAccount(user);
  return user;
}

export async function signUp(email: string, password: string, name?: string): Promise<Account> {
  const { user } = await post("/api/public/auth/signup", { email, password, name });
  if (!user) throw new Error("Could not create the account.");
  adoptAccount(user);
  return user;
}

export async function signOut(): Promise<void> {
  try {
    await post("/api/public/auth/signout");
  } finally {
    cache(null);
    // Give this device a fresh sync key so it stops exchanging the account's rows.
    setAccountId("");
  }
}
