"use client";

import { useEffect } from "react";

// The service worker is production-only. In development it caches Next's HMR
// chunks and page HTML, which serves stale code, breaks hydration and, with
// it, every client-side animation. Any worker left over from an earlier run is
// removed here so browsers that already have one recover on their own.
async function clearDevServiceWorkers() {
	const registrations = await navigator.serviceWorker.getRegistrations();
	await Promise.all(registrations.map((reg) => reg.unregister()));

	if ("caches" in window) {
		const keys = await caches.keys();
		await Promise.all(keys.map((key) => caches.delete(key)));
	}
}

function registerServiceWorker() {
	navigator.serviceWorker
		.register("/sw.js")
		.then((reg) => {
			// Check for updates on load
			reg.addEventListener("updatefound", () => {
				const installingWorker = reg.installing;
				if (!installingWorker) return;

				installingWorker.addEventListener("statechange", () => {
					if (
						installingWorker.state === "installed" &&
						navigator.serviceWorker.controller
					) {
						// New content is available, ready for refresh
						console.info("[PWA] New content is available; please refresh.");
					}
				});
			});
		})
		.catch((err) => {
			console.error("[PWA] Service worker registration failed:", err);
		});
}

export function PwaRegister() {
	useEffect(() => {
		if (!("serviceWorker" in navigator)) return;

		if (process.env.NODE_ENV !== "production") {
			clearDevServiceWorkers().catch((err) => {
				console.error("[PWA] Could not clear dev service workers:", err);
			});
			return;
		}

		// Secure contexts only: https, plus localhost for `next start`.
		if (!window.isSecureContext) return;

		// The effect can run after the window `load` event has already fired, in
		// which case a `load` listener would never be called.
		if (document.readyState === "complete") {
			registerServiceWorker();
			return;
		}

		window.addEventListener("load", registerServiceWorker, { once: true });
		return () => window.removeEventListener("load", registerServiceWorker);
	}, []);

	return null;
}
