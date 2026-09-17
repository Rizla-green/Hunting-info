// Service worker: offline-first, silent update only when online.
//
// IMPORTANT: bump CACHE_VERSION every release, in step with APP_VERSION
// in js/version.js. Changing this string is what makes the phone pull
// fresh files next time it has a connection — without it, the old
// cached version keeps being served forever.
const CACHE_VERSION = "hunting-info-v4.2.1";

const CORE_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/app.css",
  "./js/version.js",
  "./js/config.js",
  "./js/dropbox-backup.js",
  "./js/export.js",
  "./js/leaflet-loader.js",
  "./js/season-utils.js",
  "./js/location-match.js",
  "./js/land-farms.js",
  "./js/farm-profile.js",
  "./js/species-log.js",
  "./js/deer-log.js",
  "./js/zeroing.js",
  "./js/firearms.js",
  "./js/cull-plan-import.js",
  "./js/tracking.js",
  "./js/reference-info.js",
  "./js/app.js",
  "./icons_final/tracking.png",
  "./icons_final/firearms.png",
  "./icons_final/deer.png",
  "./icons_final/fox.png",
  "./icons_final/rabbit.png",
  "./icons_final/rat.png",
  "./icons_final/squirrel.png",
  "./icons_final/crow.png",
  "./icons_final/pheasant.png",
  "./icons_final/goat.png",
  "./icons_final/boar.png",
  "./icons_final/clay.png",
  "./icons_final/zero.png",
  "./icons_final/hazzard.png",
  "./icons_final/firearms.png",
  "./icons_final/gate.png",
  "./icons_final/water.png",
  "./icons_final/building.png",
  "./icons_final/footpath.png",
  "./icons_final/farm.png",
  "./icons_final/logo-192.png",
  "./icons_final/logo-512.png"
  // Menu tile + marker icons are added here too once finalised per section build.
];

// --- Install: pre-cache the app shell ---
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(CORE_FILES))
  );
  // Don't force-activate immediately — let the update apply silently
  // on next load rather than interrupting a session in progress.
  self.skipWaiting();
});

// --- Activate: clear out any old cache versions ---
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// --- Fetch: cache-first, falling back to network ---
// Offline: always served from cache, no update check attempted.
// Online: if a file isn't cached yet, fetch it and cache it for next time.
// The actual "new version available" pull happens via CACHE_VERSION
// changing on deploy — this fetch handler just serves what's cached.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          // Only cache successful, same-origin responses.
          if (response && response.status === 200 && response.type === "basic") {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline and not cached — nothing more we can do for this request.
          return cached;
        });
    })
  );
});
