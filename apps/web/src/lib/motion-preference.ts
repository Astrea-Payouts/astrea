export type MotionPreference = "system" | "reduced" | "full";

export const MOTION_PREFERENCE_STORAGE_KEY = "astrea:motion-preference";
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const PREFERENCES: readonly MotionPreference[] = ["system", "reduced", "full"];

export function isMotionPreference(value: unknown): value is MotionPreference {
	return (
		typeof value === "string" && PREFERENCES.includes(value as MotionPreference)
	);
}

/**
 * Anything unrecognised falls back to "system" — a stale or hand-edited
 * localStorage value must not strand someone in a mode they cannot explain.
 */
export function parseMotionPreference(raw: string | null): MotionPreference {
	return isMotionPreference(raw) ? raw : "system";
}

/**
 * The OS preference is the default, not the verdict.
 *
 * People turn Windows' "Animation effects" off for reasons that have nothing to
 * do with vestibular sensitivity — battery, a slow GPU, plain taste — and the
 * inverse is just as real: someone can leave the OS alone and still want a
 * marketing page to stop moving. So an explicit choice wins in both directions,
 * and "system" defers.
 */
export function resolveReducedMotion(
	preference: MotionPreference,
	systemPrefersReduced: boolean,
): boolean {
	if (preference === "reduced") return true;
	if (preference === "full") return false;
	return systemPrefersReduced;
}

/** The preference to store when someone flips the switch to `reduced`. */
export function preferenceForToggle(reduced: boolean): MotionPreference {
	return reduced ? "reduced" : "full";
}

type Matcher = (query: string) => MediaQueryList | undefined;

const defaultMatcher: Matcher = (query) =>
	typeof window === "undefined" ? undefined : window.matchMedia?.(query);

/**
 * Reports the OS reduced-motion preference and keeps reporting it.
 *
 * Split from the hook so it can be covered in this project's "node" test
 * environment, and because the subscription is the part that is easy to get
 * wrong: reading `matches` once at mount misses people who flip the OS setting
 * with the page already open, which on Windows is a single toggle in
 * Settings > Accessibility > Visual effects.
 *
 * Calls back immediately with the current value. Returns an unsubscribe.
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

export function readStoredMotionPreference(): MotionPreference {
	try {
		return parseMotionPreference(
			window.localStorage.getItem(MOTION_PREFERENCE_STORAGE_KEY),
		);
	} catch {
		// Private mode, blocked storage, embedded contexts.
		return "system";
	}
}

export function writeStoredMotionPreference(
	preference: MotionPreference,
): void {
	try {
		if (preference === "system") {
			window.localStorage.removeItem(MOTION_PREFERENCE_STORAGE_KEY);
		} else {
			window.localStorage.setItem(MOTION_PREFERENCE_STORAGE_KEY, preference);
		}
	} catch {
		// Non-fatal: the choice just will not survive a reload.
	}
}
