export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "astrea:theme";

/**
 * The site shipped dark-only, so dark stays the default and nobody sees a
 * change until they flip the switch themselves.
 */
export const DEFAULT_THEME: Theme = "dark";

export function isTheme(value: unknown): value is Theme {
	return value === "light" || value === "dark";
}

/**
 * Anything unrecognised falls back to the default — a stale or hand-edited
 * localStorage value must not strand someone in a mode they cannot explain.
 */
export function parseTheme(raw: string | null): Theme {
	return isTheme(raw) ? raw : DEFAULT_THEME;
}

export function readStoredTheme(): Theme {
	try {
		return parseTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
	} catch {
		// Private mode, blocked storage, embedded contexts.
		return DEFAULT_THEME;
	}
}

export function writeStoredTheme(theme: Theme): void {
	try {
		if (theme === DEFAULT_THEME) {
			window.localStorage.removeItem(THEME_STORAGE_KEY);
		} else {
			window.localStorage.setItem(THEME_STORAGE_KEY, theme);
		}
	} catch {
		// Non-fatal: the choice just will not survive a reload.
	}
}

/** Flips the `.dark` class the shadcn tokens in globals.css key off. */
export function applyTheme(theme: Theme): void {
	const root = document.documentElement;
	root.classList.toggle("dark", theme === "dark");
	// Keeps native controls, scrollbars and form fields in step with the theme.
	root.style.colorScheme = theme;
}

/**
 * How long the theme cross-fade lasts. The number lives in CSS
 * (`::view-transition-*(root)` in globals.css) because that is where the
 * browser reads it; it is repeated here only so the two stay easy to find.
 */
export const THEME_TRANSITION_MS = 300;

/**
 * Whether to cross-fade the theme change with the View Transitions API.
 *
 * False where the API does not exist, in which case the theme just switches
 * instantly, and whenever motion is reduced. `data-motion` is what
 * MotionPreferenceProvider publishes (OS setting plus the in-page override),
 * so this honours the visitor's "reduce animations" choice without needing
 * that provider to wrap this one.
 */
export function shouldAnimateThemeChange(): boolean {
	if (typeof document === "undefined") return false;
	return typeof document.startViewTransition === "function";
}

/**
 * Inlined in <head> so it runs before first paint. The server always renders
 * `.dark` (the default), so the only case to correct is a stored "light" —
 * without this, those visitors would see a flash of dark on every load.
 */
export const THEME_INIT_SCRIPT = `(function(){try{if(localStorage.getItem("${THEME_STORAGE_KEY}")==="light"){var r=document.documentElement;r.classList.remove("dark");r.style.colorScheme="light"}}catch(e){}})();`;
