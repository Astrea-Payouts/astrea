import { describe, expect, it, vi } from "vitest";
import {
	isMotionPreference,
	type MotionPreference,
	parseMotionPreference,
	preferenceForToggle,
	REDUCED_MOTION_QUERY,
	resolveReducedMotion,
	watchReducedMotion,
} from "@/lib/motion-preference";

describe("resolveReducedMotion", () => {
	it("follows the OS when the visitor has not chosen", () => {
		expect(resolveReducedMotion("system", true)).toBe(true);
		expect(resolveReducedMotion("system", false)).toBe(false);
	});

	it("lets an explicit choice override the OS in BOTH directions", () => {
		// The whole point of the control: someone whose OS has animations off
		// for battery or taste can still opt back in, and someone whose OS says
		// nothing can still ask the page to hold still.
		expect(resolveReducedMotion("full", true)).toBe(false);
		expect(resolveReducedMotion("reduced", false)).toBe(true);
	});

	it("is stable when the choice and the OS agree", () => {
		expect(resolveReducedMotion("reduced", true)).toBe(true);
		expect(resolveReducedMotion("full", false)).toBe(false);
	});
});

describe("parseMotionPreference", () => {
	it("accepts the three valid values", () => {
		for (const p of ["system", "reduced", "full"] as MotionPreference[]) {
			expect(parseMotionPreference(p)).toBe(p);
		}
	});

	it("falls back to system for anything unrecognised", () => {
		// A stale or hand-edited localStorage value must not strand someone in
		// a mode they cannot explain.
		expect(parseMotionPreference(null)).toBe("system");
		expect(parseMotionPreference("")).toBe("system");
		expect(parseMotionPreference("REDUCED")).toBe("system");
		expect(parseMotionPreference("no-preference")).toBe("system");
	});

	it("guards the type", () => {
		expect(isMotionPreference("reduced")).toBe(true);
		expect(isMotionPreference("nope")).toBe(false);
		expect(isMotionPreference(undefined)).toBe(false);
	});
});

describe("preferenceForToggle", () => {
	it("always stores an explicit value, never system", () => {
		// Flipping the switch is an explicit act; it must pin the choice rather
		// than hand control back to the OS.
		expect(preferenceForToggle(true)).toBe("reduced");
		expect(preferenceForToggle(false)).toBe("full");
	});
});

/** Minimal stand-in for MediaQueryList — the test env has no DOM. */
function fakeMediaQueryList(matches: boolean) {
	const listeners = new Set<(event: MediaQueryListEvent) => void>();
	return {
		mql: {
			matches,
			addEventListener: (_: string, l: (e: MediaQueryListEvent) => void) => {
				listeners.add(l);
			},
			removeEventListener: (_: string, l: (e: MediaQueryListEvent) => void) => {
				listeners.delete(l);
			},
		} as unknown as MediaQueryList,
		emit(next: boolean) {
			for (const l of listeners) l({ matches: next } as MediaQueryListEvent);
		},
		listenerCount: () => listeners.size,
	};
}

describe("watchReducedMotion", () => {
	it("reports the current preference immediately", () => {
		const onChange = vi.fn();
		watchReducedMotion(onChange, () => fakeMediaQueryList(true).mql);
		expect(onChange).toHaveBeenCalledWith(true);
	});

	it("queries the standard media feature", () => {
		const matchMedia = vi.fn(() => fakeMediaQueryList(false).mql);
		watchReducedMotion(vi.fn(), matchMedia);
		expect(matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
		expect(REDUCED_MOTION_QUERY).toBe("(prefers-reduced-motion: reduce)");
	});

	it("keeps reporting when the OS setting changes after mount", () => {
		const fake = fakeMediaQueryList(false);
		const onChange = vi.fn();
		watchReducedMotion(onChange, () => fake.mql);

		expect(onChange).toHaveBeenLastCalledWith(false);
		fake.emit(true);
		expect(onChange).toHaveBeenLastCalledWith(true);
		fake.emit(false);
		expect(onChange).toHaveBeenLastCalledWith(false);
	});

	it("unsubscribes so a remount does not stack listeners", () => {
		const fake = fakeMediaQueryList(false);
		const stop = watchReducedMotion(vi.fn(), () => fake.mql);
		expect(fake.listenerCount()).toBe(1);
		stop();
		expect(fake.listenerCount()).toBe(0);
	});

	it("assumes motion is fine where matchMedia is unavailable", () => {
		const onChange = vi.fn();
		const stop = watchReducedMotion(onChange, () => undefined);
		expect(onChange).toHaveBeenCalledWith(false);
		expect(() => stop()).not.toThrow();
	});
});
