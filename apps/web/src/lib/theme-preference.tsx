export type Theme = "light" | "dark";

// Cookie, not localStorage, like next-intl's locale cookie. The pages are
// statically rendered, so the server never reads it: THEME_INIT_SCRIPT does,
// before first paint.
export const THEME_COOKIE = "astrea-theme";
// Same lifetime as next-intl's locale cookie, so the two preferences expire
// together instead of one outliving the other.
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

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
		return parseTheme(readCookie(THEME_COOKIE));
	} catch {
		// Blocked cookies, embedded contexts.
		return DEFAULT_THEME;
	}
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
 * Inlined in <head> by the locale layout so it runs before first paint. The
 * static HTML always carries `.dark` (the default), so the only case to
 * correct is a stored "light"; without this, those visitors would see a flash
 * of dark on every load.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=([^;]*)/);if(m&&decodeURIComponent(m[1])==="light"){var r=document.documentElement;r.classList.remove("dark");r.style.colorScheme="light"}}catch(e){}})();`;

/**
 * Whether to cross-fade the theme change with the View Transitions API (the
 * duration lives in globals.css). Off where the browser lacks the API and
 * when reduced motion is on: MotionPreferenceProvider mirrors both the in-app
 * toggle and the OS setting into `data-motion` on <html>.
 */
export function shouldAnimateThemeChange(): boolean {
	if (typeof document === "undefined") return false;
	if (document.documentElement.dataset.motion === "reduced") return false;
	return typeof document.startViewTransition === "function";
}
