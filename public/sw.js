/*
 * Ascend Service Worker — High-reliability offline shell & asset engine
 *
 * Guarantees zero-network offline functionality for the installed desktop/mobile PWA.
 * Pre-caches route shells, compiled client script bundles, stylesheets, WASM/data
 * payloads (PGlite local database), and brand assets.
 */

const VERSION = "ascend-v5";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const MEDIA_CACHE = `${VERSION}-media`;
const KEEP = [SHELL_CACHE, ASSET_CACHE, MEDIA_CACHE];

/** Core app routes pre-cached during service worker installation */
const ROUTES = [
  "/",
  "/today",
  "/goals",
  "/focus",
  "/calendar",
  "/insights",
  "/tree",
  "/team",
  "/achieved",
  "/settings",
  "/auth",
];

const OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ascend</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0B0E14;color:#E6EAF2;font:15px/1.6 system-ui,-apple-system,sans-serif;text-align:center;padding:2rem}
  h1{font-size:1.25rem;margin:0 0 .5rem;font-weight:600}
  p{color:#93A0B5;margin:0 0 1.25rem;max-width:380px}
  button{font:inherit;padding:.65rem 1.4rem;border-radius:999px;border:0;background:#6D8BFF;color:#07090F;cursor:pointer;font-weight:600}
</style>
</head><body><div>
  <h1>Ascend is preparing your offline environment</h1>
  <p>Please connect briefly to finish saving your workspace to this device.</p>
  <button onclick="location.reload()">Refresh</button>
</div></body></html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const [shellCache, assetCache, mediaCache] = await Promise.all([
        caches.open(SHELL_CACHE),
        caches.open(ASSET_CACHE),
        caches.open(MEDIA_CACHE),
      ]);

      // 1. Core static brand & manifest assets
      const coreMedia = [
        "/manifest.json",
        "/favicon.png",
        "/icons/icon-192.png",
        "/icons/icon-512.png",
      ];
      await Promise.allSettled(
        coreMedia.map(async (url) => {
          try {
            const res = await fetch(url);
            if (res && (res.ok || res.type === "opaque")) {
              await mediaCache.put(url, res);
            }
          } catch {}
        }),
      );

      // 2. Precache sw-assets.json (all compiled bundles, wasm, data, styles generated during build)
      try {
        const manifestRes = await fetch("/sw-assets.json");
        if (manifestRes && manifestRes.ok) {
          const assets = await manifestRes.json();
          if (Array.isArray(assets)) {
            await Promise.allSettled(
              assets.map(async (asset) => {
                try {
                  const res = await fetch(asset);
                  if (res && (res.ok || res.type === "opaque")) {
                    await assetCache.put(asset, res);
                  }
                } catch {}
              }),
            );
          }
        }
      } catch {}

      // 3. Precache route shells and extract referenced scripts & styles
      const dynamicAssets = new Set();
      await Promise.allSettled(
        ROUTES.map(async (route) => {
          try {
            const res = await fetch(route, { credentials: "same-origin" });
            if (res && res.ok) {
              await shellCache.put(route, res.clone());
              const html = await res.text();
              const scriptMatches = html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi);
              for (const m of scriptMatches) {
                if (m[1]) dynamicAssets.add(m[1]);
              }
              const linkMatches = html.matchAll(/<link[^>]+href=["']([^"']+)["']/gi);
              for (const m of linkMatches) {
                if (m[1] && !m[1].startsWith("http")) dynamicAssets.add(m[1]);
              }
            }
          } catch {}
        }),
      );

      // 4. Cache extracted scripts/styles from routes
      await Promise.allSettled(
        Array.from(dynamicAssets).map(async (url) => {
          try {
            const res = await fetch(url);
            if (res && (res.ok || res.type === "opaque")) {
              await assetCache.put(url, res);
            }
          } catch {}
        }),
      );

      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => !KEEP.includes(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

function shellKeyFor(url) {
  return url.pathname === "/" ? "/" : url.pathname.replace(/\/+$/, "") || "/";
}

async function handleNavigation(request) {
  const url = new URL(request.url);
  const cache = await caches.open(SHELL_CACHE);
  const key = shellKeyFor(url);

  // Network-first with swift 2000ms timeout, falling back cleanly to cached shell
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const fresh = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);
    if (fresh && fresh.ok) {
      void cache.put(key, fresh.clone());
      return fresh;
    }
  } catch {
    // Offline or network timeout — use offline cache
  }

  const cached =
    (await cache.match(key)) ??
    (await cache.match(key, { ignoreSearch: true })) ??
    (await cache.match("/today")) ??
    (await cache.match("/"));
  if (cached) return cached;

  return new Response(OFFLINE_HTML, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  // Exact match only: scripts that differ by query string are different modules, and
  // serving one for the other breaks the app.
  const cached = await cache.match(request);

  // Background network update
  const network = fetch(request)
    .then((res) => {
      if (res && (res.ok || res.type === "opaque")) {
        void cache.put(request, res.clone());
      }
      return res;
    })
    .catch(() => undefined);

  if (cached) return cached;
  const fresh = await network;
  return fresh ?? Response.error();
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached =
    (await cache.match(request)) ?? (await cache.match(request, { ignoreSearch: true }));
  if (cached) return cached;

  try {
    const res = await fetch(request);
    if (res && (res.ok || res.type === "opaque")) {
      void cache.put(request, res.clone());
    }
    return res;
  } catch {
    return Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Development-server modules change on every edit — never cache them.
  if (
    url.origin === self.location.origin &&
    /^\/(src|@vite|@id|@fs|@react-refresh|node_modules|__)/.test(url.pathname)
  ) {
    return;
  }

  // Server functions and dynamic backend APIs must reach the network
  if (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_server"))
  ) {
    return;
  }

  // HTML page navigations
  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  // Same-origin static assets
  if (url.origin === self.location.origin) {
    if (["script", "style", "worker"].includes(request.destination)) {
      event.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
      return;
    }
    if (["image", "font", "audio", "manifest"].includes(request.destination)) {
      event.respondWith(cacheFirst(request, MEDIA_CACHE));
      return;
    }
    // Static assets, hashed bundles, wasm, and database payloads
    if (/\.(js|mjs|css|wasm|data|json|png|svg|ico|webmanifest|woff2?|ttf)$/.test(url.pathname)) {
      if (/\.(png|svg|ico|webmanifest|woff2?|ttf)$/.test(url.pathname)) {
        event.respondWith(cacheFirst(request, MEDIA_CACHE));
      } else {
        event.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
      }
      return;
    }
    return;
  }

  // Google Fonts & Web font providers
  if (/^https:\/\/fonts\.(googleapis|gstatic)\.com/.test(url.href)) {
    event.respondWith(staleWhileRevalidate(request, MEDIA_CACHE));
  }
});

/* ---------- Background reminders (Web Push) ----------
 * Pushes arrive without a payload; the worker asks the server which reminders were
 * just sent to this device and shows them. */
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let items = [];
      try {
        const sub = await self.registration.pushManager.getSubscription();
        if (sub) {
          const res = await fetch("/api/public/push/pending", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
          const json = await res.json();
          if (Array.isArray(json.items)) items = json.items;
        }
      } catch (_) {
        /* offline or server busy — fall back to a generic reminder */
      }
      if (items.length === 0) items = [{ id: "generic", label: "Time for your next step." }];
      await Promise.all(
        items.map((item) =>
          self.registration.showNotification("Ascend Reminder", {
            body: String(item.label || "Reminder"),
            icon: "/icons/icon-192.png",
            badge: "/icons/icon-192.png",
            tag: "reminder-" + item.id,
            data: { url: "/today" },
          }),
        ),
      );
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/today";
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of wins) {
        if ("focus" in w) {
          await w.focus();
          if ("navigate" in w) await w.navigate(url).catch(() => undefined);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
