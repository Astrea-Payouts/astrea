"use client";

import { useEffect, useState } from "react";

/**
 * Whether the page has been scrolled further than `threshold` pixels.
 *
 * Deliberately a plain passive scroll listener rather than an
 * IntersectionObserver on a sentinel: the header needs this on every page, and
 * a sentinel would have to be injected at the top of each one. There is no
 * rAF throttle either — the handler only calls setState with a boolean, and
 * React bails out of the re-render when the value has not changed, so a scroll
 * burst costs one comparison per event and nothing more.
 *
 * Works under Lenis, which drives real `window.scrollTo` calls and therefore
 * emits native scroll events like any other scrolling.
 */
export function useScrolledPast(threshold: number): boolean {
	const [scrolled, setScrolled] = useState(false);

	useEffect(() => {
		const read = () => setScrolled(window.scrollY > threshold);

		// Covers a reload that restores a scroll position part-way down.
		read();
		window.addEventListener("scroll", read, { passive: true });
		return () => window.removeEventListener("scroll", read);
	}, [threshold]);

	return scrolled;
}
