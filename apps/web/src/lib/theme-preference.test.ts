import { describe, expect, it } from "vitest";
import {
	DEFAULT_THEME,
	parseTheme,
	THEME_INIT_SCRIPT,
	THEME_STORAGE_KEY,
} from "./theme-preference";

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

describe("THEME_INIT_SCRIPT", () => {
	it("reads the same key the provider writes", () => {
		expect(THEME_INIT_SCRIPT).toContain(`"${THEME_STORAGE_KEY}"`);
	});
});
