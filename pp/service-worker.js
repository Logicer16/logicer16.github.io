/**
 * @file The site's service worker.
 */
/// <reference lib="esnext" />
/// <reference lib="webworker" />

const cacheId = "SW Cache - v1";

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
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/solid.min.css": "1",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/webfonts/fa-solid-900.woff2": "1"
};

// Register service worker if script is running in the browser
if (typeof window === "undefined") {
  initServiceWorker();
} else {
  registerServiceWorker();
}

/**
 * Format a local path to include it's revision.
 *
 * @param {keyof Files} path The path of the file.
 * @returns {string} The formatted path.
 */
function formatPath(path) {
  // As long as there are no other query parameters (which there shouldn't be for cacheable resources) this should keep working
  return `${path}?__WB_REVISION__=${files[path]}`;
}

/**
 * Add a HTTP response header to a response.
 *
 * @param {Headers} headers The set of headers to add the header to.
 * @param {string} name The name of the header to add.
 * @param {string} value The value of the new header.
 * @returns {Headers} The updated set of headers.
 */
// function addHeader(headers, name, value) {
//   const newHeaders = new Headers(headers);
//   if (!newHeaders.has(name)) newHeaders.set(name, value);
//   return newHeaders;
// }

/**
 * Adds a HTTP response headers to a response.
 *
 * @param {Response} originalResponse The response to add the headers to.
 * @returns {Response} The modified response.
 */
function addHeaders(originalResponse) {
  const newHeaders = originalResponse.headers;

  return new Response(originalResponse.body, {
    headers: newHeaders,
    status: originalResponse.status,
    statusText: originalResponse.statusText
  });
}

/**
 * Extract the path component of a URL.
 *
 * @param {URL} url The url to extract the path from.
 * @returns {string} The url's path component.
 */
function extractPath(url) {
  return url.href.slice(url.href.indexOf(url.host) + url.host.length);
}

/**
 * Create a new cache and add the site's files to the cache to allow offline use.
 *
 * @returns {Promise<void[]>} A promise which fulfils when all of the files have been added to the cache.
 */
async function addFilesToCache() {
  const cache = await caches.open(cacheId);
  const cachedPaths = new Set(
    (await cache.keys()).map((request) => {
      return extractPath(new URL(request.url));
    })
  );
  const filePaths = Object.keys(files).map((entry) => {
    return formatPath(entry);
  });
  return Promise.all(
    filePaths.map(async (path) => {
      if (!cachedPaths.has(path)) return cache.add(path);
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

  for await (const cacheName of caches.keys()) {
    if (cacheName !== cacheId) {
      console.log(`Deleting outdated cache: ${cacheName}`);
      promises.push(caches.delete(cacheName));
    }    
  }

  const cache = await caches.open(cacheId);
  for (const key of await cache.keys()) {
    const url = new URL(key.url);
    const path = extractPath(url);
    if (
      !(url.pathname in Object.keys(files)) ||
      path !== formatPath(url.pathname)
    ) {
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
     * @returns {Promise<Response>} The processed fetch response.
     */
    async function respondToFetch() {
      const request = event.request;

      const url = new URL(request.url);

      // Resources cached on install can always be served from the cache
      const cache = await caches.open(cacheId);
      const path = url.pathname;
      if (Object.keys(files).includes(path)) {
        const cacheMatch = await cache.match(formatPath(path));
        if (cacheMatch !== undefined) {
          return addHeaders(cacheMatch);
        }
      }

      const response = await fetch(request);

      return addHeaders(response);
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
      .then(() => {
        console.log("Service worker registered");
      })
      .catch((/** @type {unknown} */ error) => {
        console.warn("Service worker registration failed", error);
      });
  }
}
