/**
 * @file The site's service worker.
 */
/// <reference lib="esnext" />
/// <reference lib="webworker" />

const cacheVersion = "1";
const cacheId = `SW Cache - v${cacheVersion}`;

/** @typedef {Record<string, string>} Files */

/** @type {Files} */
const files = {
  "./": "1",
  "./manifest.json": "1",
  "./img/pp%20icon%20-%2016x16.png": "1",
  "./img/pp%20icon%20-%2032x32.png": "1",
  "./img/pp%20icon%20-%2048x48.png": "1",
  "./img/pp%20icon%20-%2064x64.png": "1",
  "./img/pp%20icon%20-%2096x96.png": "1",
  "./img/pp%20icon%20-%20112x112.png": "1",
  "./img/pp%20icon%20-%20128x128.png": "1",
  "./img/pp%20icon%20-%20144x144.png": "1",
  "./img/pp%20icon%20-%20160x160.png": "1",
  "./img/pp%20icon%20-%20176x176.png": "1",
  "./img/pp%20icon%20-%20192x192.png": "1",
  "./img/pp%20icon%20-%20256x256.png": "1",
  "./img/pp%20icon%20-%20512x512.png": "1",
  "./img/pp%20icon%20-%201024x1024.png": "1",
  "./img/pp%20icon%20masked%20-%2064x64.png": "1",
  "./img/pp%20icon%20masked%20-%20128x128.png": "1",
  "./img/pp%20icon%20masked%20-%20256x256.png": "1",
  "./img/pp%20icon%20masked%20-%20512x512.png": "1",
  "./img/pp%20icon%20masked%20-%201024x1024.png": "1",
  "./fonts/sono/sono-200.ttf": "1",
  "./fonts/sono/sono-400.ttf": "1",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/solid.min.css":
    "1",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/webfonts/fa-solid-900.woff2":
    "1"
};

const fileURLs = new Set(
  Object.keys(files).map((element) => formatURL(element))
);

// Register service worker if script is running in the browser
if (typeof window === "undefined") {
  initServiceWorker();
} else {
  registerServiceWorker();
}

/**
 * Format a url to include it's revision.
 *
 * @param {string | URL} url A URL or path relative to the service worker script's url.
 * @returns {URL} The formatted url.
 */
function formatURL(url) {
  url = normaliseURL(url)
  url.hash = "";
  url.searchParams.set("__WB_REVISION__", files[url.href] ?? cacheVersion);
  return url;
}

/**
 * Normalise a URL or relative path to a URL object.
 *
 * @param {string | URL} url A URL or path relative to the service worker script's url.
 * @returns {URL} A URL object representing the url provided.
 */
function normaliseURL(url) {
  return new URL(url, self.location.href);
}

/**
 * Create a new cache and add the site's files to the cache to allow offline use.
 *
 * @returns {Promise<void[]>} A promise which fulfils when all of the files have been added to the cache.
 */
async function addFilesToCache() {
  const cache = await caches.open(cacheId);
  const cachedURLs = new Set(
    (await cache.keys()).map((request) => {
      return formatURL(request.url);
    })
  );

  return Promise.all(
    [...fileURLs].map(async (url) => {
      if (!cachedURLs.has(url)) return cache.add(url);
    })
  );
}

/**
 * Removes files from the cache which are no longer needed.
 *
 * @returns {Promise<boolean[]>} A promise which resolves with the status of each of the `cache.delete()` calls.
 */
async function pruneCache() {
  /** @type {Promise<boolean>[]} */
  const promises = [];

  for (const cacheName of await caches.keys()) {
    if (cacheName !== cacheId) {
      console.log(`Deleting outdated cache: ${cacheName}`);
      promises.push(caches.delete(cacheName));
    }
  }

  const cache = await caches.open(cacheId);
  for (const key of await cache.keys()) {
    const url = formatURL(key.url);
    if (!fileURLs.has(url)) {
      promises.push(cache.delete(key));
    }
  }
  return Promise.all(promises);
}

/**
 * Adds service worker listeners.
 */
function initServiceWorker() {
  self.addEventListener("install", (/** @type {ExtendableEvent} */ event) => {
    event.waitUntil(addFilesToCache());
  });

  self.addEventListener("activate", (/** @type {ExtendableEvent} */ event) => {
    event.waitUntil(pruneCache());
  });

  self.addEventListener("fetch", (/** @type {FetchEvent} */ event) => {
    /**
     * Responds to a fetch request. Adds the cross origin isolation headers and falls back to the local cache if the server is unavailable.
     *
     * @returns {Promise<Response>} The processed fetch response.
     */
    async function respondToFetch() {
      const request = event.request;

      const url = new URL(request.url);

      // Resources cached on install can always be served from the cache
      const cache = await caches.open(cacheId);

      const cacheMatch = await cache.match(formatURL(url));
      if (cacheMatch !== undefined) {
        return cacheMatch;
      }

      return fetch(request);
    }

    event.respondWith(respondToFetch());
  });
}

/**
 * Register the service worker for the Pink Picker.
 */
function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("./service-worker.js")
      .then((registration) => {
        console.log("Service worker registered");
        return registration.update();
      })
      .catch((/** @type {unknown} */ error) => {
        console.warn("Service worker registration failed", error);
      });
  }
}
