// @vitest-environment jsdom
//
// The project's default Vitest environment is "node" (see vitest.config.ts) —
// most lib tests never touch a real DOM. This file does (document.cookie,
// <html> classes), so it opts into jsdom just for itself instead of flipping
// the environment for the whole suite.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	applyTheme,
	DEFAULT_THEME,
	isTheme,
	parseTheme,
	readStoredTheme,
	shouldAnimateThemeChange,
	THEME_COOKIE,
	THEME_INIT_SCRIPT,
	writeStoredTheme,
} from "./theme-preference";

const root = document.documentElement;

afterEach(() => {
	// First: the cookie spies below would otherwise throw on the reset.
	vi.restoreAllMocks();
	document.cookie = `${THEME_COOKIE}=; Max-Age=0; Path=/`;
	root.className = "";
	root.removeAttribute("style");
	delete root.dataset.motion;
});

describe("parseTheme", () => {
	it("accepts the two valid themes", () => {
		expect(parseTheme("light")).toBe("light");
		expect(parseTheme("dark")).toBe("dark");
		expect(isTheme("light")).toBe(true);
	});

	it("falls back to the default for anything else", () => {
		expect(parseTheme(null)).toBe(DEFAULT_THEME);
		expect(parseTheme("")).toBe(DEFAULT_THEME);
		expect(parseTheme("system")).toBe(DEFAULT_THEME);
		expect(parseTheme("LIGHT")).toBe(DEFAULT_THEME);
	});
});

describe("readStoredTheme / writeStoredTheme", () => {
	it("round-trips a non-default theme through the cookie", () => {
		writeStoredTheme("light");
		expect(document.cookie).toContain(`${THEME_COOKIE}=light`);
		expect(readStoredTheme()).toBe("light");
	});

	it("clears the cookie instead of writing the default", () => {
		writeStoredTheme("light");
		writeStoredTheme("dark");
		expect(document.cookie).not.toContain(THEME_COOKIE);
		expect(readStoredTheme()).toBe(DEFAULT_THEME);
	});

	it("falls back to the default when cookies are unreadable", () => {
		vi.spyOn(document, "cookie", "get").mockImplementation(() => {
			throw new Error("blocked");
		});
		expect(readStoredTheme()).toBe(DEFAULT_THEME);
	});

	it("swallows a blocked cookie write", () => {
		vi.spyOn(document, "cookie", "set").mockImplementation(() => {
			throw new Error("blocked");
		});
		expect(() => writeStoredTheme("light")).not.toThrow();
	});
});

describe("applyTheme", () => {
	it("toggles the dark class and the colour scheme", () => {
		applyTheme("dark");
		expect(root.classList.contains("dark")).toBe(true);
		expect(root.style.colorScheme).toBe("dark");

		applyTheme("light");
		expect(root.classList.contains("dark")).toBe(false);
		expect(root.style.colorScheme).toBe("light");
	});
});

describe("THEME_INIT_SCRIPT", () => {
	// Runs the exact string the layout inlines, against the static HTML's
	// default `.dark` class.
	const run = () => new Function(THEME_INIT_SCRIPT)();

	it("removes .dark when the cookie says light", () => {
		root.classList.add("dark");
		writeStoredTheme("light");
		run();
		expect(root.classList.contains("dark")).toBe(false);
		expect(root.style.colorScheme).toBe("light");
	});

	it("leaves .dark alone without a cookie or with an unknown value", () => {
		root.classList.add("dark");
		run();
		expect(root.classList.contains("dark")).toBe(true);

		document.cookie = `${THEME_COOKIE}=sepia; Path=/`;
		run();
		expect(root.classList.contains("dark")).toBe(true);
	});
});

describe("shouldAnimateThemeChange", () => {
	it("follows View Transitions support", () => {
		const supported = typeof document.startViewTransition === "function";
		expect(shouldAnimateThemeChange()).toBe(supported);
	});

	it("is false when reduced motion is on, even with the API", () => {
		const original = document.startViewTransition;
		document.startViewTransition = vi.fn() as never;
		try {
			expect(shouldAnimateThemeChange()).toBe(true);
			root.dataset.motion = "reduced";
			expect(shouldAnimateThemeChange()).toBe(false);
		} finally {
			document.startViewTransition = original;
		}
	});
});
