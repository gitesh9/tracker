import type { Reminder } from "./types";

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!notificationsSupported()) return "unsupported";
  return Notification.requestPermission();
}

export function showNotification(title: string, body: string) {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  new Notification(title, { body, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png" });
}

const firedKey = (id: string, day: string, at: string) => `ascend:reminded:${id}:${day}:${at}`;

/**
 * Fires enabled reminders whose time has arrived while the app is open.
 * Each reminder fires at most once per day per device.
 */
export function runReminderTick(reminders: Reminder[]) {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const minutesNow = now.getHours() * 60 + now.getMinutes();

  for (const reminder of reminders) {
    if (!reminder.is_enabled) continue;
    const [h, m] = String(reminder.remind_at).split(":").map(Number);
    const target = (h ?? 0) * 60 + (m ?? 0);
    if (minutesNow < target || minutesNow > target + 30) continue;
    const key = firedKey(reminder.id, day, String(reminder.remind_at));
    if (localStorage.getItem(key)) continue;
    localStorage.setItem(key, "1");
    showNotification("Ascend", reminder.label);
  }
}
