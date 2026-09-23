// No @vitest-environment pragma here on purpose: this file runs under the
// project's default "node" environment (vitest.config.ts), where `document`
// and `window` are genuinely undefined — the same condition Next.js's server
// render sees. That is exactly the branch this test exists to cover, so it
// must NOT share a file with theme-preference.test.ts (which forces jsdom).
import { describe, expect, it } from "vitest";
import { shouldAnimateThemeChange } from "./theme-preference";

describe("shouldAnimateThemeChange (SSR)", () => {
	it("is false without a DOM", () => {
		expect(shouldAnimateThemeChange()).toBe(false);
	});
});
