// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, screen } from "@testing-library/react";
import { createTranslator } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { messages, renderWithIntl } from "@/test/render-with-intl";

const EVENT_ID = "20000000-0000-0000-0000-000000000004";
const ORGANIZER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const OTHER = "GDLWMKYOJYXW4EIE6DNE2K354RTWDDBXDJCZMPICRBPHO3OBIUDWJSNC";

const { mockDb, mockSession, mockRedirect, mockStartQuote, mockClient } =
	vi.hoisted(() => ({
		mockDb: { event: { findUnique: vi.fn() } },
		mockSession: vi.fn(),
		mockRedirect: vi.fn(),
		mockStartQuote: vi.fn(),
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
	startQuote: mockStartQuote,
}));
vi.mock("./go-live", () => ({
	GoLive: (props: unknown) => {
		mockClient(props);
		return <div data-testid="go-live" />;
	},
}));

const { CoreGoError, CoreGoConfigError } = await import("@/lib/core-go/client");
const { default: StartPage, generateMetadata } = await import("./page");

const params = Promise.resolve({ locale: "en", id: EVENT_ID });

const event = {
	id: EVENT_ID,
	name: "Vertical slice B2",
	status: "CREATED",
	timezone: "America/Costa_Rica",
	judgingDeadlineAt: new Date("2026-12-31T23:59:00Z"),
	organizerWallet: { address: ORGANIZER },
};

async function renderPage() {
	const ui = await StartPage({ params });
	return renderWithIntl(ui);
}

describe("StartPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockDb.event.findUnique.mockResolvedValue(event);
		mockSession.mockResolvedValue({ id: "w-org", address: ORGANIZER });
		mockStartQuote.mockResolvedValue({
			fee: "5000000",
			balance: "2000000",
			shortfall: "3000000",
		});
	});

	afterEach(() => {
		cleanup();
	});

	it("calls notFound for an unknown event", async () => {
		mockDb.event.findUnique.mockResolvedValue(null);

		await expect(StartPage({ params })).rejects.toThrow("NEXT_NOT_FOUND");
	});

	it.each(["DRAFT", "LIVE", "CANCELLED"])(
		"redirects to the public page when the event is %s, not CREATED",
		async (status) => {
			mockDb.event.findUnique.mockResolvedValue({ ...event, status });

			await expect(StartPage({ params })).rejects.toThrow("NEXT_REDIRECT");
			expect(mockRedirect).toHaveBeenCalledWith({
				href: `/events/${EVENT_ID}`,
				locale: "en",
			});
			expect(mockStartQuote).not.toHaveBeenCalled();
		},
	);

	it("asks for a wallet when there is no session", async () => {
		mockSession.mockResolvedValue(null);

		await renderPage();

		expect(screen.getByText(messages.GoLivePage.connect)).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "connect-wallet" }),
		).toBeVisible();
		expect(screen.queryByTestId("go-live")).not.toBeInTheDocument();
		expect(mockStartQuote).not.toHaveBeenCalled();
	});

	it("redirects to the public page when the session wallet is not the organizer", async () => {
		mockSession.mockResolvedValue({ id: "w-other", address: OTHER });

		await expect(StartPage({ params })).rejects.toThrow("NEXT_REDIRECT");
		expect(mockRedirect).toHaveBeenCalledWith({
			href: `/events/${EVENT_ID}`,
			locale: "en",
		});
		expect(mockStartQuote).not.toHaveBeenCalled();
	});

	it("quotes as the session wallet and mounts the client component with the deadline in the event's timezone", async () => {
		await renderPage();

		expect(mockStartQuote).toHaveBeenCalledWith(EVENT_ID, ORGANIZER);
		expect(mockClient).toHaveBeenCalledWith({
			eventId: EVENT_ID,
			address: ORGANIZER,
			initialQuote: {
				fee: "5000000",
				balance: "2000000",
				shortfall: "3000000",
			},
			// 23:59 UTC is 17:59 in Costa Rica (UTC-6, no DST).
			judgingDeadline: expect.stringMatching(/Dec 31, 2026.*5:59/),
			timezone: "America/Costa_Rica",
			symbol: "USDC",
		});
		expect(screen.getByText(messages.EventStatus.CREATED)).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: /Vertical slice B2/ }),
		).toHaveAttribute("href", `/events/${EVENT_ID}`);
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});

	it("passes a null deadline through when the event has none", async () => {
		mockDb.event.findUnique.mockResolvedValue({
			...event,
			judgingDeadlineAt: null,
		});

		await renderPage();

		expect(mockClient).toHaveBeenCalledWith(
			expect.objectContaining({ judgingDeadline: null }),
		);
	});

	it("shows Go's error instead of the client component when the quote fails", async () => {
		mockStartQuote.mockRejectedValue(
			new CoreGoError(409, "event_not_on_chain", "no escrowEventId"),
		);

		await renderPage();

		const alert = screen.getByRole("alert");
		expect(alert).toHaveTextContent(messages.GoLivePage.quoteFailed);
		expect(alert).toHaveTextContent("event_not_on_chain — no escrowEventId");
		expect(screen.queryByTestId("go-live")).not.toBeInTheDocument();
	});

	it("labels a missing CORE_GO_URL as config and a plain throw as unknown", async () => {
		mockStartQuote.mockRejectedValueOnce(
			new CoreGoConfigError("CORE_GO_URL is not configured"),
		);
		await renderPage();
		expect(screen.getByRole("alert")).toHaveTextContent(
			"config — CORE_GO_URL is not configured",
		);
		cleanup();

		mockStartQuote.mockRejectedValueOnce(new Error("ECONNREFUSED"));
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
			name: "Vertical slice B2",
		});
		await expect(generateMetadata({ params })).resolves.toEqual({
			title: `${messages.GoLivePage.title} — Vertical slice B2`,
		});

		mockDb.event.findUnique.mockResolvedValueOnce(null);
		await expect(generateMetadata({ params })).resolves.toEqual({
			title: messages.GoLivePage.title,
		});
	});
});

describe("non-UUID event ids", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	const badParams = Promise.resolve({ locale: "en", id: "new" });

	it("calls notFound without querying the database", async () => {
		await expect(StartPage({ params: badParams })).rejects.toThrow(
			"NEXT_NOT_FOUND",
		);
		expect(mockDb.event.findUnique).not.toHaveBeenCalled();
	});

	it("builds metadata without querying the database", async () => {
		await expect(generateMetadata({ params: badParams })).resolves.toEqual({
			title: messages.GoLivePage.title,
		});
		expect(mockDb.event.findUnique).not.toHaveBeenCalled();
	});
});
