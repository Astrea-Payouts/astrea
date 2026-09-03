"use client";

import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useLayoutEffect,
	useMemo,
	useState,
} from "react";
import {
	type MotionPreference,
	preferenceForToggle,
	readStoredMotionPreference,
	resolveReducedMotion,
	watchReducedMotion,
	writeStoredMotionPreference,
} from "@/lib/motion-preference";

interface MotionPreferenceValue {
	/** What the visitor chose. "system" means "follow the OS". */
	preference: MotionPreference;
	setPreference: (preference: MotionPreference) => void;
	/** What the OS is asking for, regardless of the choice above. */
	systemPrefersReduced: boolean;
	/** The two combined — what components should actually act on. */
	reduced: boolean;
}

const MotionPreferenceContext = createContext<MotionPreferenceValue | null>(
	null,
);

// useLayoutEffect warns during SSR, where it is a no-op anyway.
const useIsomorphicLayoutEffect =
	typeof window === "undefined" ? useEffect : useLayoutEffect;

export function MotionPreferenceProvider({
	children,
}: {
	children: ReactNode;
}) {
	// Both start at their neutral value so the server render and the first
	// client render agree. The layout effect below corrects them before the
	// browser paints, so there is no flash of the wrong mode — which matters
	// because the hero background is above the fold.
	const [preference, setPreferenceState] = useState<MotionPreference>("system");
	const [systemPrefersReduced, setSystemPrefersReduced] = useState(false);

	useIsomorphicLayoutEffect(() => {
		setPreferenceState(readStoredMotionPreference());
		return watchReducedMotion(setSystemPrefersReduced);
	}, []);

	const setPreference = useCallback((next: MotionPreference) => {
		setPreferenceState(next);
		writeStoredMotionPreference(next);
	}, []);

	const reduced = resolveReducedMotion(preference, systemPrefersReduced);

	// Exposed so CSS can key off it too, without every rule needing the
	// media query and the override separately.
	useEffect(() => {
		document.documentElement.dataset.motion = reduced ? "reduced" : "full";
	}, [reduced]);

	const value = useMemo(
		() => ({ preference, setPreference, systemPrefersReduced, reduced }),
		[preference, setPreference, systemPrefersReduced, reduced],
	);

	return (
		<MotionPreferenceContext.Provider value={value}>
			{children}
		</MotionPreferenceContext.Provider>
	);
}

/**
 * The visitor's motion preference and the controls to change it.
 *
 * Throws without a provider, because a control that silently does nothing is
 * worse than a build error.
 */
export function useMotionPreference(): MotionPreferenceValue {
	const context = useContext(MotionPreferenceContext);
	if (!context) {
		throw new Error(
			"useMotionPreference requires <MotionPreferenceProvider> (mounted in the locale layout)",
		);
	}
	return context;
}

/**
 * Whether to suppress motion. See docs/ui-motion.md for what that covers.
 *
 * Falls back to watching the OS directly when there is no provider, so a
 * component still behaves correctly if it is ever rendered outside the app
 * shell — it just loses the in-page override.
 */
export function useReducedMotion(): boolean {
	const context = useContext(MotionPreferenceContext);
	const [fallback, setFallback] = useState(false);

	useEffect(() => {
		if (context) return;
		return watchReducedMotion(setFallback);
	}, [context]);

	return context ? context.reduced : fallback;
}

export { preferenceForToggle };
