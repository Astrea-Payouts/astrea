import { describe, expect, it, vi } from "vitest";
import {
	REDUCED_MOTION_QUERY,
	watchReducedMotion,
} from "@/hooks/use-reduced-motion";

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
			for (const l of listeners) {
				l({ matches: next } as MediaQueryListEvent);
			}
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

	it("keeps reporting when the preference changes after mount", () => {
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
