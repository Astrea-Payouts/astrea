"use client";

import { PrismBackground } from "@/components/prism-background";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

/**
 * The hero's Prism background, frozen when the user asks for reduced motion.
 *
 * Prism already knows how to freeze: its render loop does
 * `if (TS < 1e-6) continueRAF = false`, which paints one frame and then stops
 * requesting animation frames entirely — no idle GPU work, unlike simply
 * slowing it down. Reaching that path is the awkward part, because TS is
 * derived as `Math.max(0, timeScale || 1)`. `timeScale={0}` is falsy, so it
 * coalesces to 1 and the background ends up running more than three times
 * faster than its 0.3 default — the exact opposite of the intent. A tiny
 * non-zero value is the only way in.
 *
 * Kept here rather than in prism-background.tsx so that file stays a faithful
 * port of the live source. See docs/ui-motion.md.
 */
export const FROZEN_TIME_SCALE = 1e-9;
export const DEFAULT_TIME_SCALE = 0.3;

export function HeroPrism() {
	const reduced = useReducedMotion();

	return (
		<PrismBackground
			suspendWhenOffscreen
			offset={{ x: 90 }}
			timeScale={reduced ? FROZEN_TIME_SCALE : DEFAULT_TIME_SCALE}
			className="h-full w-full"
		/>
	);
}
