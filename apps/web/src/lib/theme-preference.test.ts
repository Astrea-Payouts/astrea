import { afterEach, describe, expect, it } from "vitest";
import {
	DEFAULT_THEME,
	parseTheme,
	readStoredTheme,
	shouldAnimateThemeChange,
	THEME_COOKIE,
	THEME_INIT_SCRIPT,
	THEME_TRANSITION_MS,
	writeStoredTheme,
} from "./theme-preference";

const LEGACY_STORAGE_KEY = "astrea:theme";

function clearCookie() {
	document.cookie = `${THEME_COOKIE}=; Max-Age=0; Path=/`;
}

afterEach(() => {
	clearCookie();
	window.localStorage.removeItem(LEGACY_STORAGE_KEY);
});

describe("parseTheme", () => {
	it("accepts the two valid themes", () => {
		expect(parseTheme("light")).toBe("light");
		expect(parseTheme("dark")).toBe("dark");
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

	it("migrates a legacy localStorage value once, then forgets it", () => {
		window.localStorage.setItem(LEGACY_STORAGE_KEY, "light");
		expect(readStoredTheme()).toBe("light");
		expect(window.localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull();
		expect(document.cookie).toContain(`${THEME_COOKIE}=light`);
	});
});

describe("THEME_INIT_SCRIPT", () => {
	it("reads the same cookie the provider writes", () => {
		expect(THEME_INIT_SCRIPT).toContain(`${THEME_COOKIE}=`);
	});

	it("falls back to the legacy storage key", () => {
		expect(THEME_INIT_SCRIPT).toContain(`"${LEGACY_STORAGE_KEY}"`);
	});
});

describe("shouldAnimateThemeChange", () => {
	it("is false without a DOM (SSR, the node test environment)", () => {
		expect(shouldAnimateThemeChange()).toBe(false);
	});
});

describe("THEME_TRANSITION_MS", () => {
	it("stays at 300ms, the value hard-coded in globals.css", () => {
		expect(THEME_TRANSITION_MS).toBe(300);
	});
});
