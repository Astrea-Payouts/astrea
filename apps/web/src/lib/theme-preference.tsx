export type Theme = "light" | "dark";

// Cookie, not localStorage: same mechanism next-intl uses for the language
// cookie, so both preferences are visible to the server on the very first
// request instead of only after the client hydrates.
export const THEME_COOKIE = "astrea-theme";
// Same lifetime as next-intl's locale cookie, so the two preferences expire
// together instead of one outliving the other.
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

// Where the preference used to live. Nothing writes here anymore; it only
// exists so a returning visitor's old choice is migrated once instead of
// silently reset back to the default.
const LEGACY_STORAGE_KEY = "astrea:theme";

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
 * cookie value must not strand someone in a mode they cannot explain.
 */
export function parseTheme(raw: string | null | undefined): Theme {
	return isTheme(raw) ? raw : DEFAULT_THEME;
}

function readCookie(name: string): string | null {
	const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
	return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string): void {
	document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
}

function deleteCookie(name: string): void {
	document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
}

export function readStoredTheme(): Theme {
	try {
		const cookie = readCookie(THEME_COOKIE);
		if (cookie !== null) return parseTheme(cookie);

		// One-time migration for a visitor who chose a theme back when it lived
		// in localStorage: honour it once, move it to the cookie, and stop
		// looking here again.
		const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
		if (legacy !== null) {
			const theme = parseTheme(legacy);
			writeStoredTheme(theme);
			window.localStorage.removeItem(LEGACY_STORAGE_KEY);
			return theme;
		}
	} catch {
		// Private mode, blocked storage, embedded contexts.
	}
	return DEFAULT_THEME;
}

export function writeStoredTheme(theme: Theme): void {
	try {
		if (theme === DEFAULT_THEME) {
			deleteCookie(THEME_COOKIE);
		} else {
			writeCookie(THEME_COOKIE, theme);
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
 * Inlined in <head> so it runs before first paint. The server always renders
 * `.dark` (the default), so the only case to correct is a stored "light" —
 * without this, those visitors would see a flash of dark on every load.
 *
 * Reads the cookie first, and falls back to the legacy localStorage key so a
 * visitor mid-migration (cookie not written yet, tab not remounted) still
 * gets the right theme on this load instead of one frame of the wrong one.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=([^;]*)/);var v=m?decodeURIComponent(m[1]):localStorage.getItem("${LEGACY_STORAGE_KEY}");if(v==="light"){var r=document.documentElement;r.classList.remove("dark");r.style.colorScheme="light"}}catch(e){}})();`;

/**
 * How long the theme cross-fade lasts. The number lives in CSS
 * (`::view-transition-*(root)` in globals.css) because that is where the
 * browser reads it; it is repeated here only so the two stay easy to find.
 */
export const THEME_TRANSITION_MS = 300;

/**
 * Whether the browser can cross-fade the theme change with the View
 * Transitions API. Where it cannot, the theme just switches instantly.
 */
export function shouldAnimateThemeChange(): boolean {
	if (typeof document === "undefined") return false;
	return typeof document.startViewTransition === "function";
}
