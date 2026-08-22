"use client";

import { useEffect } from "react";

export function PwaRegister() {
	useEffect(() => {
		if (
			(typeof window !== "undefined" &&
				"serviceWorker" in navigator &&
				window.location.protocol === "https:") ||
			window.location.hostname === "localhost" ||
			window.location.hostname === "127.0.0.1"
		) {
			window.addEventListener("load", () => {
				navigator.serviceWorker
					.register("/sw.js")
					.then((reg) => {
						// Check for updates on load
						reg.addEventListener("updatefound", () => {
							const installingWorker = reg.installing;
							if (installingWorker) {
								installingWorker.addEventListener("statechange", () => {
									if (
										installingWorker.state === "installed" &&
										navigator.serviceWorker.controller
									) {
										// New content is available, ready for refresh
										console.info(
											"[PWA] New content is available; please refresh.",
										);
									}
								});
							}
						});
					})
					.catch((err) => {
						console.error("[PWA] Service worker registration failed:", err);
					});
			});
		}
	}, []);

	return null;
}
