import { describe, expect, it } from "vitest";
import {
	DEFAULT_TIME_SCALE,
	FROZEN_TIME_SCALE,
} from "@/components/marketing/hero-prism";

/**
 * Prism derives its internal time scale as `Math.max(0, timeScale || 1)` and
 * stops requesting animation frames when that value drops below 1e-6. These
 * assertions pin the two things that are easy to get wrong about that.
 */
const prismTimeScale = (timeScale: number) => Math.max(0, timeScale || 1);
const PRISM_FREEZE_THRESHOLD = 1e-6;
const freezes = (timeScale: number) =>
	prismTimeScale(timeScale) < PRISM_FREEZE_THRESHOLD;

describe("Prism reduced-motion freeze", () => {
	it("freezes the hero background at the reduced-motion time scale", () => {
		expect(freezes(FROZEN_TIME_SCALE)).toBe(true);
	});

	it("keeps animating at the default time scale", () => {
		expect(freezes(DEFAULT_TIME_SCALE)).toBe(false);
	});

	it("does NOT freeze at timeScale 0 — 0 is falsy and coalesces to 1", () => {
		// The obvious way to freeze it. `0 || 1` is 1, so this runs the
		// background more than three times faster than its own default rather
		// than stopping it. Hence the tiny non-zero constant.
		expect(prismTimeScale(0)).toBe(1);
		expect(freezes(0)).toBe(false);
		expect(prismTimeScale(0)).toBeGreaterThan(DEFAULT_TIME_SCALE);
	});
});
