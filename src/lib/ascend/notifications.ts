import { toast } from "sonner";
import type { Reminder } from "./types";
import { soundscapeEngine } from "./soundscapes";

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (!notificationsSupported()) return "unsupported";
  try {
    return Notification.permission;
  } catch {
    return "unsupported";
  }
}

export async function requestNotificationPermission(): Promise<
  NotificationPermission | "unsupported"
> {
  if (!notificationsSupported()) return "unsupported";
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return "unsupported";
  }
}

/**
 * Universal notification dispatcher:
 * 1. Tries ServiceWorker showNotification (best for Android / PWA / Mac Safari)
 * 2. Tries standard Web Notification
 * 3. Always plays pleasant Web Audio reminder chime
 * 4. Triggers subtle mobile haptic vibration
 * 5. Shows distinctive in-app notification toast
 */
export async function showNotification(
  title: string,
  body: string,
  options?: { playSound?: boolean; vibrate?: boolean; tag?: string },
) {
  const shouldPlaySound = options?.playSound ?? true;
  const shouldVibrate = options?.vibrate ?? true;

  // 1. Play subtle audio chime
  if (shouldPlaySound) {
    soundscapeEngine.playReminderChime();
  }

  // 2. Trigger mobile haptics if supported
  if (shouldVibrate && typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate([150, 80, 150]);
    } catch {
      // ignore
    }
  }

  // 3. In-App Notification Toast (Guarantees visible feedback on iPhone / Mac / PC / Android even if OS notifications are denied or disabled)
  toast(title, {
    description: body,
    duration: 6000,
    icon: "⏰",
  });

  // 4. System / OS Notification
  if (notificationsSupported() && Notification.permission === "granted") {
    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready.catch(() => null);
        if (registration && typeof registration.showNotification === "function") {
          await registration.showNotification(title, {
            body,
            icon: "/icons/icon-192.png",
            badge: "/icons/icon-192.png",
            tag: options?.tag || "ascend-reminder",
          });
          return;
        }
      }

      // Fallback to standard window Notification
      new Notification(title, {
        body,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: options?.tag || "ascend-reminder",
      });
    } catch {
      // OS notification failsafe (toast + audio already fired)
    }
  }
}

const firedKey = (id: string, day: string, at: string) => `ascend:reminded:${id}:${day}:${at}`;

/**
 * Fires enabled reminders whose time has arrived.
 * Checks against current minutes and triggers multi-channel notification.
 * Safe for background resumes on iPhone / Android / Mac / PC.
 */
export function runReminderTick(reminders: Reminder[]) {
  if (typeof window === "undefined" || !reminders || reminders.length === 0) return;

  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const minutesNow = now.getHours() * 60 + now.getMinutes();

  for (const reminder of reminders) {
    if (!reminder.is_enabled) continue;
    const timeStr = String(reminder.remind_at || "09:00:00");
    const [h, m] = timeStr.split(":").map(Number);
    const target = (h ?? 0) * 60 + (m ?? 0);

    // Fires if we are within the target minute or up to 15 mins after (e.g. if device woke from sleep)
    if (minutesNow < target || minutesNow > target + 15) continue;

    const key = firedKey(reminder.id, day, timeStr.slice(0, 5));
    if (localStorage.getItem(key)) continue;

    try {
      localStorage.setItem(key, "1");
    } catch {
      // Storage quota or private mode failsafe
    }

    void showNotification("Ascend Reminder", reminder.label, {
      tag: `reminder-${reminder.id}`,
    });
  }
}
