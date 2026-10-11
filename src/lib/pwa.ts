/**
 * Single registrar for the app-shell service worker.
 * Never registers inside an iframe (e.g. AI Studio preview) or with ?sw=off.
 * Always allows registration in standalone installed PWA mode or full-window navigation.
 */
function isBlockedContext(): boolean {
  if (typeof window === "undefined") return true;

  // Always enable service worker for installed standalone PWA
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  if (isStandalone) return false;

  // Suppress worker inside editor preview iframes to prevent caching stale previews
  if (window.self !== window.top) return true;

  // Explicit opt-out flag for troubleshooting
  if (new URLSearchParams(window.location.search).get("sw") === "off") return true;

  return false;
}

async function unregisterAppWorker() {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    registrations
      .filter((r) => (r.active?.scriptURL ?? r.installing?.scriptURL ?? "").endsWith("/sw.js"))
      .map((r) => r.unregister()),
  );
}

export function registerServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (isBlockedContext()) {
    void unregisterAppWorker();
    return;
  }

  const register = () => {
    void navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => registration.update())
      .catch(() => {
        /* offline installs retry on the next launch */
      });
  };

  // This runs after hydration, so the window "load" event has usually fired
  // already — waiting for it would mean never registering at all.
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
