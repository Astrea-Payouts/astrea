"use client";

import { useEffect, useState } from "react";

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

type Matcher = (query: string) => MediaQueryList | undefined;

const defaultMatcher: Matcher = (query) =>
	typeof window === "undefined" ? undefined : window.matchMedia?.(query);

/**
 * Reports the reduced-motion preference and keeps reporting it.
 *
 * Split out from the hook so it can be tested without a DOM (this project's
 * vitest environment is "node"), and because the subscription is the part that
 * is easy to get wrong: reading `matches` once at mount misses users who flip
 * the OS setting while the page is open, which on Windows is a single toggle in
 * Settings > Accessibility > Visual effects.
 *
 * Returns an unsubscribe function. Calls back immediately with the current
 * value.
 */
export function watchReducedMotion(
	onChange: (reduced: boolean) => void,
	matchMedia: Matcher = defaultMatcher,
): () => void {
	const mq = matchMedia(REDUCED_MOTION_QUERY);
	if (!mq) {
		onChange(false);
		return () => {};
	}

	onChange(mq.matches);
	const listener = (event: MediaQueryListEvent) => onChange(event.matches);
	mq.addEventListener("change", listener);
	return () => mq.removeEventListener("change", listener);
}

/**
 * Whether the user has asked for reduced motion.
 *
 * Starts `false` so the server render and the first client render agree — the
 * effect corrects it immediately after mount. Callers that swap between a
 * moving and a static presentation should make sure the two look the same at
 * rest, so that correction is not a visible flash. See docs/ui-motion.md.
 */
export function useReducedMotion(): boolean {
	const [reduced, setReduced] = useState(false);

	useEffect(() => watchReducedMotion(setReduced), []);

	return reduced;
}
