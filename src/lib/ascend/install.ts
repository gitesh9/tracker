// Ascend PWA Install Helper & Device Detection Engine
// Supports Android (beforeinstallprompt), Desktop Chrome/Edge, iOS Safari (Home Screen guide), and iframe breakouts.

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(canInstall: boolean) => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notifyListeners();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notifyListeners();
  });
}

function notifyListeners() {
  const can = Boolean(deferredPrompt);
  listeners.forEach((fn) => fn(can));
}

export function subscribeInstallPrompt(cb: (canInstall: boolean) => void): () => void {
  listeners.add(cb);
  cb(Boolean(deferredPrompt));
  return () => {
    listeners.delete(cb);
  };
}

export function getDeferredPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      Boolean((navigator as unknown as { standalone?: boolean }).standalone))
  );
}

export function isInIframe(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function isIOS(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isAndroid(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

export function isMac(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return /Macintosh|MacIntel|MacPPC|Mac68K/i.test(navigator.userAgent) && !isIOS();
}

export async function triggerInstallPrompt(): Promise<{
  success: boolean;
  outcome?: "accepted" | "dismissed" | "guide" | "standalone" | "iframe";
}> {
  if (isStandalone()) {
    return { success: true, outcome: "standalone" };
  }

  if (deferredPrompt) {
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        deferredPrompt = null;
        notifyListeners();
      }
      return { success: true, outcome: choice.outcome };
    } catch {
      return { success: false };
    }
  }

  if (isInIframe()) {
    return { success: false, outcome: "iframe" };
  }

  return { success: false, outcome: "guide" };
}
