// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "@/hooks/use-theme";
import { THEME_COOKIE } from "@/lib/theme-preference";
import { messages, renderWithIntl } from "@/test/render-with-intl";
import { ThemeToggle } from "./theme-toggle";

const root = document.documentElement;
type MaybeTransition = { startViewTransition?: unknown };

// Pins the API per test (own property shadows whatever jsdom provides), so the
// default path switches synchronously and the transition tests opt in.
beforeEach(() => {
	(document as MaybeTransition).startViewTransition = undefined;
});

afterEach(() => {
	delete (document as MaybeTransition).startViewTransition;
	cleanup();
	document.cookie = `${THEME_COOKIE}=; Max-Age=0; Path=/`;
	root.className = "";
	root.removeAttribute("style");
	delete root.dataset.motion;
	vi.restoreAllMocks();
});

function renderToggle(variant?: "switch" | "labelled") {
	return renderWithIntl(
		<ThemeProvider>
			<ThemeToggle variant={variant} />
		</ThemeProvider>,
	);
}

describe("ThemeToggle", () => {
	it("starts on dark and flips to light, persisting the choice", () => {
		root.classList.add("dark");
		renderToggle();

		const toggle = screen.getByRole("switch", { name: messages.Theme.label });
		expect(toggle).toHaveAttribute("aria-checked", "true");

		fireEvent.click(toggle);
		expect(toggle).toHaveAttribute("aria-checked", "false");
		expect(root.classList.contains("dark")).toBe(false);
		expect(document.cookie).toContain(`${THEME_COOKIE}=light`);

		fireEvent.click(toggle);
		expect(toggle).toHaveAttribute("aria-checked", "true");
		expect(root.classList.contains("dark")).toBe(true);
		expect(document.cookie).not.toContain(THEME_COOKIE);
	});

	it("picks up a stored light choice on mount", () => {
		document.cookie = `${THEME_COOKIE}=light; Path=/`;
		renderToggle("labelled");

		const toggle = screen.getByRole("switch", { name: messages.Theme.label });
		expect(toggle).toHaveAttribute("aria-checked", "false");
		expect(root.classList.contains("dark")).toBe(false);
	});

	it("cross-fades through the View Transitions API when it is available", () => {
		const startViewTransition = vi.fn((update: () => void) => update());
		document.startViewTransition = startViewTransition as never;
		renderToggle();
		fireEvent.click(screen.getByRole("switch"));
		expect(startViewTransition).toHaveBeenCalledOnce();
		expect(root.classList.contains("dark")).toBe(false);
	});

	it("switches instantly under reduced motion", () => {
		const startViewTransition = vi.fn();
		document.startViewTransition = startViewTransition as never;
		root.dataset.motion = "reduced";
		renderToggle();
		fireEvent.click(screen.getByRole("switch"));
		expect(startViewTransition).not.toHaveBeenCalled();
		expect(root.classList.contains("dark")).toBe(false);
	});
});

describe("useTheme", () => {
	it("throws outside a ThemeProvider", () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		expect(() => renderHook(() => useTheme())).toThrow(/ThemeProvider/);
	});
});
