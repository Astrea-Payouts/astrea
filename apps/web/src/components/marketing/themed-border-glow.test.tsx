// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemedBorderGlow } from "./themed-border-glow";

const { theme, glowProps } = vi.hoisted(() => ({
	theme: { current: "dark" as "light" | "dark" },
	glowProps: vi.fn(),
}));

vi.mock("@/hooks/use-theme", () => ({
	useTheme: () => ({ theme: theme.current, setTheme: vi.fn() }),
}));
vi.mock("@/components/marketing/border-glow-in-view", () => ({
	BorderGlowInView: (props: Record<string, unknown>) => {
		glowProps(props);
		return null;
	},
}));

afterEach(() => {
	cleanup();
	glowProps.mockReset();
});

describe("ThemedBorderGlow", () => {
	it.each([
		["dark", "#09090b"],
		["light", "#ffffff"],
	] as const)("gives BorderGlow the %s surface", (current, surface) => {
		theme.current = current;
		render(<ThemedBorderGlow className="extra">card</ThemedBorderGlow>);

		const props = glowProps.mock.calls[0][0];
		expect(props.backgroundColor).toBe(surface);
		// The CSS fallback that makes the first paint right before hydration.
		expect(props.className).toContain("dark:!bg-[#09090b]");
		expect(props.className).toContain("extra");
	});
});
