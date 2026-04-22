// service-worker.js — Offline-Cache für die statische App.
// Einfache Cache-First-Strategie für die Shell, Network-First für JSON-Daten.

"use strict";

const CACHE_VERSION = "iqtest-chc-v1.0.0";
const SHELL_ASSETS = [
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

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Network-First für JSON-Daten (Items können aktualisiert werden).
  if (url.pathname.endsWith(".json")) {
    event.respondWith(
      fetch(req).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Cache-First für Shell-Assets.
  event.respondWith(
    caches.match(req).then((cached) =>
      cached || fetch(req).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone));
        return res;
      }).catch(() => cached)
    )
  );
});
