const CACHE_NAME = "astrea-v1";
const PRECACHE_ASSETS = [
	"/",
	"/favicon.ico",
	"/icons/icon-192x192.png",
	"/icons/icon-512x512.png",
	"/offline",
];

// Install: precache offline fallback and essential assets
self.addEventListener("install", (event) => {
	event.waitUntil(
		caches
			.open(CACHE_NAME)
			.then((cache) => {
				return cache.addAll(PRECACHE_ASSETS).catch((err) => {
					console.warn("[SW] Precache partially failed:", err);
				});
			})
			.then(() => self.skipWaiting()),
	);
});

// Activate: cleanup old caches
self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => {
				return Promise.all(
					keys
						.filter((key) => key !== CACHE_NAME)
						.map((key) => caches.delete(key)),
				);
			})
			.then(() => self.clients.claim()),
	);
});

// Fetch: cache-first for static assets, network-first with offline fallback for navigation
self.addEventListener("fetch", (event) => {
	const request = event.request;
	const url = new URL(request.url);

	// Only handle GET requests from the same origin
	if (request.method !== "GET" || url.origin !== self.location.origin) {
		return;
	}

	// Skip Next.js hot module reloading and internal build traces in dev
	if (url.pathname.startsWith("/_next/webpack-hmr")) {
		return;
	}

	// Navigation requests: network-first, fallback to cache, then fallback to /offline
	if (request.mode === "navigate") {
		event.respondWith(
			fetch(request)
				.then((response) => {
					// Cache the latest version of the HTML
					if (response && response.status === 200) {
						const responseClone = response.clone();
						caches
							.open(CACHE_NAME)
							.then((cache) => cache.put(request, responseClone));
					}
					return response;
				})
				.catch(async () => {
					const cachedResponse = await caches.match(request);
					if (cachedResponse) {
						return cachedResponse;
					}
					const offlineFallback = await caches.match("/offline");
					if (offlineFallback) {
						return offlineFallback;
					}
					const rootFallback = await caches.match("/");
					if (rootFallback) {
						return rootFallback;
					}
					return new Response("Offline - Astrea", {
						headers: { "Content-Type": "text/html" },
					});
				}),
		);
		return;
	}

	// Static assets (_next/static, /icons, fonts, images): cache-first, stale-while-revalidate
	if (
		url.pathname.startsWith("/_next/static/") ||
		url.pathname.startsWith("/icons/") ||
		url.pathname.match(/\.(png|jpg|jpeg|svg|webp|ico|woff|woff2|ttf|css|js)$/)
	) {
		event.respondWith(
			caches.match(request).then((cachedResponse) => {
				if (cachedResponse) {
					// Revalidate in background
					fetch(request)
						.then((networkResponse) => {
							if (networkResponse && networkResponse.status === 200) {
								caches
									.open(CACHE_NAME)
									.then((cache) => cache.put(request, networkResponse));
							}
						})
						.catch(() => {});
					return cachedResponse;
				}

				return fetch(request).then((networkResponse) => {
					if (networkResponse && networkResponse.status === 200) {
						const responseClone = networkResponse.clone();
						caches
							.open(CACHE_NAME)
							.then((cache) => cache.put(request, responseClone));
					}
					return networkResponse;
				});
			}),
		);
		return;
	}

	// Default: network-first
	event.respondWith(fetch(request).catch(() => caches.match(request)));
});
