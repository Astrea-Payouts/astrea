"use client";

import { type ComponentProps, useEffect, useRef, useState } from "react";
import BorderGlow from "@/components/marketing/border-glow";

type BorderGlowProps = ComponentProps<typeof BorderGlow>;

/**
 * BorderGlow with its intro sweep deferred until the card is actually on
 * screen.
 *
 * Upstream runs the sweep from a mount effect. These cards sit below the
 * fold, so the whole ~4s animation played out and finished while they were
 * still off screen — measured at 225px below the viewport on load — and the
 * user never saw it. Passing `animated` only once the card intersects makes
 * the sweep fire when it is worth watching.
 *
 * The gating lives here instead of in border-glow.tsx so that file stays a
 * clean port of the live source.
 *
 * This used to also bail out on prefers-reduced-motion. Removed, because it
 * was the only such check in the app: ScrollStack translates whole cards
 * hundreds of pixels, CardSwap throws them across the viewport, and Prism
 * runs a WebGL shader, none of them gated. Suppressing a highlight that
 * travels along a card border while all of that runs is not an accessibility
 * policy, it is one inconsistent special case — and it silently disabled the
 * effect for anyone whose OS has animations off (Windows' "Animation
 * effects" toggle reports reduced-motion to every browser). A real
 * reduced-motion pass belongs across the whole marketing page at once.
 */
export function BorderGlowInView({
	rootMargin = "-15% 0px",
	...props
}: BorderGlowProps & { rootMargin?: string }) {
	const wrapperRef = useRef<HTMLDivElement>(null);
	const [hasEntered, setHasEntered] = useState(false);

	useEffect(() => {
		// Observe the rendered card, not this wrapper. The wrapper is
		// `display: contents` so it generates no box at all — a 0x0 rect that
		// IntersectionObserver never reports as intersecting.
		const el = wrapperRef.current?.firstElementChild;
		if (!el || hasEntered) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((e) => e.isIntersecting)) {
					setHasEntered(true);
					observer.disconnect();
				}
			},
			{ rootMargin },
		);

		observer.observe(el);
		return () => observer.disconnect();
	}, [hasEntered, rootMargin]);

	return (
		<div ref={wrapperRef} className="contents">
			<BorderGlow {...props} animated={hasEntered} />
		</div>
	);
}
