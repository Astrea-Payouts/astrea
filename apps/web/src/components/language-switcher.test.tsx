// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render-with-intl";
import { LanguageSwitcher } from "./language-switcher";

const { mockReplace } = vi.hoisted(() => ({ mockReplace: vi.fn() }));

vi.mock("@/i18n/navigation", () => ({
	usePathname: () => "/events/abc",
	useRouter: () => ({ replace: mockReplace }),
}));

afterEach(() => {
	cleanup();
	mockReplace.mockReset();
});

describe("LanguageSwitcher", () => {
	it("is named after the language a click switches to", () => {
		renderWithIntl(<LanguageSwitcher />);
		expect(
			screen.getByRole("button", { name: "Switch to español" }),
		).toBeInTheDocument();
	});

	it("keeps the current path and moves the thumb before navigation lands", () => {
		renderWithIntl(<LanguageSwitcher variant="light" />);
		const button = screen.getByRole("button");

		fireEvent.click(button);

		expect(mockReplace).toHaveBeenCalledWith("/events/abc", { locale: "es" });
		// Locale is still "en" (the router is mocked), so the pending choice is
		// what the label now reflects.
		expect(button).toHaveAccessibleName("Switch to English");
	});
});
