/**
 * Local identity. There is no sign-in service: the app belongs to whoever holds
 * the device. A stable device id groups this device's rows in the optional
 * remote database, and the profile name lives in the local store.
 */
const DEVICE_KEY = "ascend.device.id";
const ACCOUNT_KEY = "ascend.account.id";

export const LOCAL_USER_ID = "guest_user";

function readOrCreate(key: string): string {
  if (typeof window === "undefined") return "server";
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.localStorage.setItem(key, created);
    return created;
  } catch {
    return "anonymous";
  }
}

export function getDeviceId(): string {
  return readOrCreate(DEVICE_KEY);
}

/** The sync identity: shared across devices when the user enters the same key. */
export function getAccountId(): string {
  return readOrCreate(ACCOUNT_KEY);
}

export function setAccountId(value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACCOUNT_KEY, value.trim() || crypto.randomUUID());
  } catch {
    /* ignore */
  }
}

export function getLocalUser(): { id: string; email?: string } {
  return { id: LOCAL_USER_ID };
}
