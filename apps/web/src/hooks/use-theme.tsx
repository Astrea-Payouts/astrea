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
import { flushSync } from "react-dom";
import {
	applyTheme,
	DEFAULT_THEME,
	readStoredTheme,
	shouldAnimateThemeChange,
	type Theme,
	writeStoredTheme,
} from "@/lib/theme-preference";

interface ThemeValue {
	theme: Theme;
	setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

// useLayoutEffect warns during SSR, where it is a no-op anyway.
const useIsomorphicLayoutEffect =
	typeof window === "undefined" ? useEffect : useLayoutEffect;

export function ThemeProvider({ children }: { children: ReactNode }) {
	// Starts at the default so the server render and the first client render
	// agree. The layout effect corrects it before the browser paints; the
	// inline script in <head> has already fixed the <html> class by then, so
	// there is no flash of the wrong theme.
	const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

	useIsomorphicLayoutEffect(() => {
		const stored = readStoredTheme();
		setThemeState(stored);
		applyTheme(stored);
	}, []);

	const setTheme = useCallback((next: Theme) => {
		writeStoredTheme(next);

		const commit = () => {
			// flushSync so the <html> class and every component that reacts to the
			// theme (the Prism canvas included) are in their new state by the time
			// the browser takes its "after" snapshot.
			flushSync(() => setThemeState(next));
			applyTheme(next);
		};

		if (shouldAnimateThemeChange()) {
			// Cross-fades the whole page, WebGL canvas included, which is what
			// makes the shader's instant uniform flip look smooth. Duration is set
			// in globals.css.
			document.startViewTransition(commit);
		} else {
			commit();
		}
	}, []);

	const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

	return (
		<ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
	);
}

/**
 * The visitor's theme and the control to change it.
 *
 * Throws without a provider, because a control that silently does nothing is
 * worse than a build error.
 */
export function useTheme(): ThemeValue {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error(
			"useTheme requires <ThemeProvider> (mounted in the locale layout)",
		);
	}
	return context;
}
