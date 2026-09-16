// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, screen } from "@testing-library/react";
import { createTranslator } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { messages, renderWithIntl } from "@/test/render-with-intl";

const EVENT_ID = "20000000-0000-0000-0000-000000000003";
const ORGANIZER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const OTHER = "GDLWMKYOJYXW4EIE6DNE2K354RTWDDBXDJCZMPICRBPHO3OBIUDWJSNC";

const { mockDb, mockSession, mockRedirect, mockWalletBalance, mockClient } =
	vi.hoisted(() => ({
		mockDb: { event: { findUnique: vi.fn() } },
		mockSession: vi.fn(),
		mockRedirect: vi.fn(),
		mockWalletBalance: vi.fn(),
		mockClient: vi.fn(),
	}));

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/wallet/session", () => ({ getSessionWallet: mockSession }));
vi.mock("next/navigation", () => ({
	notFound: () => {
		throw new Error("NEXT_NOT_FOUND");
	},
}));
vi.mock("next-intl/server", () => ({
	getLocale: async () => "en",
	getTranslations: async (arg: string | { namespace: string }) =>
		createTranslator({
			locale: "en",
			messages,
			namespace: (typeof arg === "string" ? arg : arg.namespace) as never,
		}),
}));
vi.mock("@/i18n/navigation", () => ({
	redirect: (args: unknown) => {
		mockRedirect(args);
		throw new Error("NEXT_REDIRECT");
	},
	Link: ({
		href,
		children,
		...rest
	}: React.ComponentProps<"a"> & { href: string }) => (
		<a href={href} {...rest}>
			{children}
		</a>
	),
}));
vi.mock("@/components/wallet-connect-button", () => ({
	WalletConnectButton: () => <button type="button">connect-wallet</button>,
}));
vi.mock("@/lib/core-go/client", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/core-go/client")>()),
	walletBalance: mockWalletBalance,
}));
vi.mock("./fund-and-create", () => ({
	FundAndCreate: (props: unknown) => {
		mockClient(props);
		return <div data-testid="fund-and-create" />;
	},
}));

const { CoreGoError } = await import("@/lib/core-go/client");
const { default: FundPage, generateMetadata } = await import("./page");

const params = Promise.resolve({ locale: "en", id: EVENT_ID });

const event = {
	id: EVENT_ID,
	name: "Vertical slice B1",
	status: "DRAFT",
	organizerWallet: { address: ORGANIZER },
	prizes: [
		{ rank: 1, amount: { toString: () => "1.5" } },
		{ rank: 2, amount: { toString: () => "1" } },
	],
};

async function renderPage() {
	const ui = await FundPage({ params });
	return renderWithIntl(ui);
}

describe("FundPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockDb.event.findUnique.mockResolvedValue(event);
		mockSession.mockResolvedValue({ id: "w-org", address: ORGANIZER });
		mockWalletBalance.mockResolvedValue({
			address: ORGANIZER,
			balance: "10000000",
		});
	});

	afterEach(() => {
		cleanup();
	});

	it("calls notFound for an unknown event", async () => {
		mockDb.event.findUnique.mockResolvedValue(null);

		await expect(FundPage({ params })).rejects.toThrow("NEXT_NOT_FOUND");
	});

	it("redirects to the public page when the event is no longer DRAFT", async () => {
		mockDb.event.findUnique.mockResolvedValue({ ...event, status: "CREATED" });

		await expect(FundPage({ params })).rejects.toThrow("NEXT_REDIRECT");
		expect(mockRedirect).toHaveBeenCalledWith({
			href: `/events/${EVENT_ID}`,
			locale: "en",
		});
		expect(mockWalletBalance).not.toHaveBeenCalled();
	});

	it("asks for a wallet when there is no session", async () => {
		mockSession.mockResolvedValue(null);

		await renderPage();

		expect(screen.getByText(messages.FundPage.connect)).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "connect-wallet" }),
		).toBeVisible();
		expect(screen.queryByTestId("fund-and-create")).not.toBeInTheDocument();
		expect(mockWalletBalance).not.toHaveBeenCalled();
	});

	it("renders an inline 403 when the session wallet is not the organizer", async () => {
		mockSession.mockResolvedValue({ id: "w-other", address: OTHER });

		await renderPage();

		const alert = screen.getByRole("alert");
		expect(alert).toHaveTextContent("403");
		expect(alert).toHaveTextContent(messages.FundPage.forbidden.notOrganizer);
		expect(screen.queryByTestId("fund-and-create")).not.toBeInTheDocument();
		expect(mockWalletBalance).not.toHaveBeenCalled();
	});

	it("sums the prizes in stroops, reads the balance as the session wallet and mounts the client component", async () => {
		await renderPage();

		expect(mockWalletBalance).toHaveBeenCalledWith(ORGANIZER, ORGANIZER);
		expect(mockClient).toHaveBeenCalledWith({
			eventId: EVENT_ID,
			address: ORGANIZER,
			initialBalance: "10000000",
			required: "25000000",
			symbol: "USDC",
		});
		expect(screen.getByText("2.5 USDC")).toBeInTheDocument();
		expect(screen.getByText("1.5 USDC")).toBeInTheDocument();
		expect(screen.getByText(messages.EventStatus.DRAFT)).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: /Vertical slice B1/ }),
		).toHaveAttribute("href", `/events/${EVENT_ID}`);
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});

	it("shows Go's error instead of the client component when the balance read fails", async () => {
		mockWalletBalance.mockRejectedValue(
			new CoreGoError(403, "not_wallet_owner", "not the caller"),
		);

		await renderPage();

		const alert = screen.getByRole("alert");
		expect(alert).toHaveTextContent(messages.FundPage.balanceFailed);
		expect(alert).toHaveTextContent("not_wallet_owner — not the caller");
		expect(screen.queryByTestId("fund-and-create")).not.toBeInTheDocument();
	});

	it("labels a non-Go failure as unknown", async () => {
		mockWalletBalance.mockRejectedValue(new Error("ECONNREFUSED"));

		await renderPage();

		expect(screen.getByRole("alert")).toHaveTextContent(
			"unknown — ECONNREFUSED",
		);
	});
});

describe("generateMetadata", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("titles the page with the event name, or the bare title when unknown", async () => {
		mockDb.event.findUnique.mockResolvedValueOnce({
			name: "Vertical slice B1",
		});
		await expect(generateMetadata({ params })).resolves.toEqual({
			title: `${messages.FundPage.title} — Vertical slice B1`,
		});

		mockDb.event.findUnique.mockResolvedValueOnce(null);
		await expect(generateMetadata({ params })).resolves.toEqual({
			title: messages.FundPage.title,
		});
	});
});
