// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, screen } from "@testing-library/react";
import { createTranslator } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { messages, renderWithIntl } from "@/test/render-with-intl";

const ORGANIZER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

const { mockSession, mockForm } = vi.hoisted(() => ({
	mockSession: vi.fn(),
	mockForm: vi.fn(),
}));

vi.mock("@/lib/wallet/session", () => ({ getSessionWallet: mockSession }));
vi.mock("next-intl/server", () => ({
	getTranslations: async (arg: string | { namespace: string }) =>
		createTranslator({
			locale: "en",
			messages,
			namespace: (typeof arg === "string" ? arg : arg.namespace) as never,
		}),
}));
vi.mock("@/components/wallet-connect-button", () => ({
	WalletConnectButton: () => <button type="button">connect-wallet</button>,
}));
vi.mock("./event-form", () => ({
	EventForm: (props: unknown) => {
		mockForm(props);
		return <form data-testid="event-form" />;
	},
}));

const { default: NewEventPage, generateMetadata } = await import("./page");

describe("NewEventPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});

	it("asks for a wallet when there is no session", async () => {
		mockSession.mockResolvedValue(null);

		renderWithIntl(await NewEventPage());

		expect(screen.getByText(messages.OrganizerNew.connect)).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "connect-wallet" }),
		).toBeVisible();
		expect(screen.queryByTestId("event-form")).not.toBeInTheDocument();
	});

	it("mounts the form with the session address as organizer", async () => {
		mockSession.mockResolvedValue({ id: "w-org", address: ORGANIZER });

		renderWithIntl(await NewEventPage());

		expect(screen.getByTestId("event-form")).toBeInTheDocument();
		expect(mockForm).toHaveBeenCalledWith({
			organizerAddress: ORGANIZER,
			symbol: "USDC",
		});
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
			messages.OrganizerNew.title,
		);
	});

	it("titles the page", async () => {
		await expect(generateMetadata()).resolves.toEqual({
			title: messages.OrganizerNew.title,
		});
	});
});
