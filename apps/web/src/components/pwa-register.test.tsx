// @vitest-environment jsdom

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PwaRegister } from "./pwa-register";

type Listener = () => void;

function fakeRegistration() {
	const listeners: Record<string, Listener> = {};
	const worker = {
		state: "installing",
		listeners: {} as Record<string, Listener>,
		addEventListener(type: string, fn: Listener) {
			this.listeners[type] = fn;
		},
	};
	return {
		worker,
		listeners,
		installing: worker as typeof worker | null,
		addEventListener: (type: string, fn: Listener) => {
			listeners[type] = fn;
		},
		unregister: vi.fn().mockResolvedValue(true),
	};
}

let registration: ReturnType<typeof fakeRegistration>;
const serviceWorker = {
	register: vi.fn(),
	getRegistrations: vi.fn(),
	controller: null as object | null,
};

function setReadyState(state: DocumentReadyState) {
	Object.defineProperty(document, "readyState", {
		configurable: true,
		get: () => state,
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	registration = fakeRegistration();
	serviceWorker.register.mockResolvedValue(registration);
	serviceWorker.getRegistrations.mockResolvedValue([registration]);
	serviceWorker.controller = null;
	Object.defineProperty(navigator, "serviceWorker", {
		configurable: true,
		value: serviceWorker,
	});
	Object.defineProperty(window, "isSecureContext", {
		configurable: true,
		value: true,
	});
	setReadyState("complete");
});

afterEach(() => {
	cleanup();
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	Reflect.deleteProperty(navigator, "serviceWorker");
	Reflect.deleteProperty(document, "readyState");
});

describe("PwaRegister in development", () => {
	it("unregisters leftover workers and clears their caches", async () => {
		vi.stubEnv("NODE_ENV", "development");
		const caches = {
			keys: vi.fn().mockResolvedValue(["a", "b"]),
			delete: vi.fn().mockResolvedValue(true),
		};
		vi.stubGlobal("caches", caches);

		render(<PwaRegister />);

		await waitFor(() => expect(caches.delete).toHaveBeenCalledTimes(2));
		expect(registration.unregister).toHaveBeenCalled();
		expect(serviceWorker.register).not.toHaveBeenCalled();
	});

	it("logs instead of throwing when cleanup fails", async () => {
		vi.stubEnv("NODE_ENV", "development");
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		serviceWorker.getRegistrations.mockRejectedValue(new Error("denied"));

		render(<PwaRegister />);

		await waitFor(() => expect(error).toHaveBeenCalled());
	});
});

describe("PwaRegister in production", () => {
	beforeEach(() => {
		vi.stubEnv("NODE_ENV", "production");
	});

	it("registers right away when the page has already loaded", async () => {
		render(<PwaRegister />);
		await waitFor(() =>
			expect(serviceWorker.register).toHaveBeenCalledWith("/sw.js"),
		);
	});

	it("waits for the load event otherwise", () => {
		setReadyState("loading");
		render(<PwaRegister />);
		expect(serviceWorker.register).not.toHaveBeenCalled();

		window.dispatchEvent(new Event("load"));
		expect(serviceWorker.register).toHaveBeenCalledOnce();
	});

	it("skips insecure contexts", () => {
		Object.defineProperty(window, "isSecureContext", {
			configurable: true,
			value: false,
		});
		render(<PwaRegister />);
		expect(serviceWorker.register).not.toHaveBeenCalled();
	});

	it("announces an update once a new worker installs over a live one", async () => {
		const info = vi.spyOn(console, "info").mockImplementation(() => {});
		serviceWorker.controller = {};
		render(<PwaRegister />);
		await waitFor(() =>
			expect(registration.listeners.updatefound).toBeDefined(),
		);

		registration.listeners.updatefound();
		registration.worker.state = "installed";
		registration.worker.listeners.statechange();

		expect(info).toHaveBeenCalledWith(
			"[PWA] New content is available; please refresh.",
		);
	});

	it("ignores an update event without an installing worker", async () => {
		registration.installing = null;
		render(<PwaRegister />);
		await waitFor(() =>
			expect(registration.listeners.updatefound).toBeDefined(),
		);
		expect(() => registration.listeners.updatefound()).not.toThrow();
	});

	it("logs a failed registration", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		serviceWorker.register.mockRejectedValue(new Error("nope"));
		render(<PwaRegister />);
		await waitFor(() =>
			expect(error).toHaveBeenCalledWith(
				"[PWA] Service worker registration failed:",
				expect.any(Error),
			),
		);
	});
});
