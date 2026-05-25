const CACHE_NAME = "appforge-cache-v1";
const OFFLINE_URL = "/offline";

const ASSETS_TO_CACHE = [
  "/",
  "/auth/login",
  "/auth/register",
  "/dashboard",
  OFFLINE_URL,
  "/manifest.json",
  "/favicon.ico"
];

// Perform install and cache core assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Caching app shell assets...");
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Perform cache cleanup upon activation
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log("[Service Worker] Removing deprecated cache...", cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Intercept fetch requests and serve with offline fallbacks
self.addEventListener("fetch", (event) => {
  // Only handle GET requests and avoid next-auth/api calls
  if (
    event.request.method !== "GET" ||
    event.request.url.includes("/api/auth") ||
    event.request.url.includes("/_next/") ||
    event.request.url.includes("chrome-extension")
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If response is valid, clone and cache it for GET requests to static subpaths
        if (
          response &&
          response.status === 200 &&
          response.type === "basic" &&
          !event.request.url.includes("/api/")
        ) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // If network request fails, search caches
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If no cache match and we are requesting a page, return the offline fallback screen
          if (event.request.mode === "navigate") {
            return caches.match(OFFLINE_URL);
          }
          return new Response("Offline resource unavailable", {
            status: 503,
            statusText: "Service Unavailable",
            headers: new Headers({ "Content-Type": "text/plain" }),
          });
        });
      })
  );
});
