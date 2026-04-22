// service-worker.js
// Auto-versionierter Offline-Cache für IQ-Test · CHC.
//
// Strategie:
//  - HTML / Navigation → Network-First (immer aktuell, fallback Cache).
//  - JS / CSS / JSON   → Stale-While-Revalidate (schneller Start, still aktualisieren).
//  - SVG / Icons       → Cache-First (selten geändert).
//  - Cross-Origin      → ignoriert (wir hosten alles selbst).
//
// Versionierung:
//  Der Platzhalter __BUILD_ID__ wird beim Deploy (GitHub Action) durch
//  den Commit-SHA + Timestamp ersetzt. Im Entwicklungsstand greift der
//  Fallback mit dem Modul-Ladezeitstempel, damit sich jede lokale Änderung
//  zuverlässig bemerkbar macht.

"use strict";

const BUILD_ID = "__BUILD_ID__";
const VERSION = BUILD_ID === "__" + "BUILD_ID__"
  ? "dev-" + Date.now().toString(36)
  : BUILD_ID;

const CACHE_NAME = "iqtest-chc-" + VERSION;

// Shell-Assets, die beim Install vorgeladen werden.
const PRECACHE = [
  "./",
  "./index.html",
  "./test.html",
  "./result.html",
  "./impressum.html",
  "./datenschutz.html",
  "./haftung.html",
  "./nutzungsbedingungen.html",
  "./ueber.html",
  "./methodik.html",
  "./manifest.json",
  "./assets/css/reset.css",
  "./assets/css/main.css",
  "./assets/css/print.css",
  "./assets/js/app.js",
  "./assets/js/test-engine.js",
  "./assets/js/scoring.js",
  "./assets/js/item-renderer.js",
  "./assets/js/storage.js",
  "./assets/js/chart.js",
  "./assets/img/favicon.svg",
  "./assets/img/icon-192.svg",
  "./assets/img/icon-512.svg"
];

// --- Install: Precache laden, sofort bereit ---
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// --- Activate: alte Caches löschen, Clients übernehmen ---
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k.startsWith("iqtest-chc-") && k !== CACHE_NAME)
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
    // Allen offenen Tabs signalisieren, dass eine neue Version aktiv ist.
    const clients = await self.clients.matchAll({ type: "window" });
    for (const client of clients) {
      client.postMessage({ type: "SW_ACTIVATED", version: VERSION });
    }
  })());
});

// --- Message-Bridge: Client kann „SKIP_WAITING“ anfordern ---
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// --- Fetch-Routing ---
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Cross-Origin nicht anfassen

  const dest = req.destination;
  const isNav = req.mode === "navigate" || dest === "document";
  const isHTML = isNav || url.pathname.endsWith(".html") || url.pathname === "/";
  const isData = url.pathname.endsWith(".json");
  const isCode = dest === "script" || dest === "style" || url.pathname.endsWith(".js") || url.pathname.endsWith(".css");
  const isImg  = dest === "image" || /\.(svg|png|jpg|jpeg|webp|avif|ico)$/i.test(url.pathname);

  if (isHTML) {
    event.respondWith(networkFirst(req));
    return;
  }
  if (isCode || isData) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }
  if (isImg) {
    event.respondWith(cacheFirst(req));
    return;
  }
  event.respondWith(staleWhileRevalidate(req));
});

// --- Strategien ---

async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(req, { cache: "no-store" });
    if (fresh && fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch (_e) {
    const cached = await cache.match(req);
    if (cached) return cached;
    // Fallback: index.html als letzte Rettung (Offline)
    const fallback = await cache.match("./index.html");
    if (fallback) return fallback;
    return new Response("Offline und kein Cache verfügbar.", {
      status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  const networkPromise = fetch(req).then((res) => {
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  return cached || (await networkPromise) || new Response("", { status: 504 });
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch (_e) {
    return new Response("", { status: 504 });
  }
}
