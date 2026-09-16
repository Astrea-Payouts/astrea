// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, screen } from "@testing-library/react";
import { createTranslator } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { messages, renderWithIntl } from "@/test/render-with-intl";

const EVENT_ID = "20000000-0000-0000-0000-000000000001";
const JUDGE = "GDCYCXUVREFDIJGGVCLSFQLMB7GQLX7MNLBMIAXDVVWPRUA66HOVMR5L";
const OTHER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

const { mockDb, mockSession, mockReleaseForm } = vi.hoisted(() => ({
	mockDb: { event: { findUnique: vi.fn() } },
	mockSession: vi.fn(),
	mockReleaseForm: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/wallet/session", () => ({ getSessionWallet: mockSession }));
vi.mock("next/navigation", () => ({
	notFound: () => {
		throw new Error("NEXT_NOT_FOUND");
	},
}));
// The server-side translator resolves against the same EN catalogue the
// client provider in renderWithIntl uses.
vi.mock("next-intl/server", () => ({
	getTranslations: async (arg: string | { namespace: string }) =>
		createTranslator({
			locale: "en",
			messages,
			// createTranslator types the namespace against the catalogue;
			// the page passes a plain string.
			namespace: (typeof arg === "string" ? arg : arg.namespace) as never,
		}),
}));
vi.mock("@/i18n/navigation", () => ({
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
vi.mock("./release-form", () => ({
	ReleaseForm: (props: unknown) => {
		mockReleaseForm(props);
		return <div data-testid="release-form" />;
	},
}));

const { default: JudgePage, generateMetadata } = await import("./page");

const params = Promise.resolve({ locale: "en", id: EVENT_ID });

const event = {
	id: EVENT_ID,
	name: "Vertical slice A",
	status: "JUDGING",
	prizes: [
		{
			rank: 1,
			amount: { toString: () => "0.2" },
			releaseTxHash: null,
			winnerTeam: null,
		},
		{
			rank: 2,
			amount: { toString: () => "0.1" },
			releaseTxHash: null,
			winnerTeam: null,
		},
	],
	judges: [{ walletAddress: JUDGE }],
	teams: [{ id: "team-a", name: "Team Winner One" }],
};

async function renderPage() {
	const ui = await JudgePage({ params });
	return renderWithIntl(ui);
}

describe("JudgePage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockDb.event.findUnique.mockResolvedValue(event);
		mockSession.mockResolvedValue({ id: "w-judge", address: JUDGE });
	});

	afterEach(() => {
		cleanup();
	});

	it("calls notFound for an unknown event", async () => {
		mockDb.event.findUnique.mockResolvedValue(null);

		await expect(JudgePage({ params })).rejects.toThrow("NEXT_NOT_FOUND");
	});

	it("asks for a wallet when there is no session", async () => {
		mockSession.mockResolvedValue(null);

		await renderPage();

		expect(screen.getByText(messages.JudgePage.connect)).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "connect-wallet" }),
		).toBeVisible();
		expect(screen.queryByTestId("release-form")).not.toBeInTheDocument();
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});

	it("renders an inline 403 when the session wallet is not the active judge", async () => {
		mockSession.mockResolvedValue({ id: "w-other", address: OTHER });

		await renderPage();

		const alert = screen.getByRole("alert");
		expect(alert).toHaveTextContent("403");
		expect(alert).toHaveTextContent(messages.JudgePage.forbidden.notJudge);
		expect(screen.queryByTestId("release-form")).not.toBeInTheDocument();
	});

	it("renders an inline 403 when the event has more than one active judge", async () => {
		mockDb.event.findUnique.mockResolvedValue({
			...event,
			judges: [{ walletAddress: JUDGE }, { walletAddress: OTHER }],
		});

		await renderPage();

		expect(screen.getByRole("alert")).toHaveTextContent(
			messages.JudgePage.forbidden.notJudge,
		);
	});

	it("renders an inline 403 for the judge while the event is not JUDGING", async () => {
		mockDb.event.findUnique.mockResolvedValue({ ...event, status: "LIVE" });

		await renderPage();

		const alert = screen.getByRole("alert");
		expect(alert).toHaveTextContent(messages.JudgePage.forbidden.notJudging);
		expect(screen.getByText(messages.EventStatus.LIVE)).toBeInTheDocument();
		expect(screen.queryByTestId("release-form")).not.toBeInTheDocument();
	});

	it("renders the release form for the active judge of a JUDGING event", async () => {
		await renderPage();

		expect(screen.getByTestId("release-form")).toBeInTheDocument();
		expect(mockReleaseForm).toHaveBeenCalledWith({
			eventId: EVENT_ID,
			judgeAddress: JUDGE,
			prizes: [
				{ rank: 1, amount: "0.2" },
				{ rank: 2, amount: "0.1" },
			],
			teams: [{ id: "team-a", name: "Team Winner One" }],
			symbol: "USDC",
		});
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
			messages.JudgePage.title,
		);
		expect(screen.getByText(messages.EventStatus.JUDGING)).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: /Vertical slice A/ }),
		).toHaveAttribute("href", `/events/${EVENT_ID}`);
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});
});

describe("JudgePage after release", () => {
	const TX_HASH =
		"0941dbcdd6958dae1c9606f225d7a8c4e8dc1a7ec9c5595eecb1a8a633e13bc5";
	const completed = {
		...event,
		status: "COMPLETED",
		prizes: [
			{
				rank: 1,
				amount: { toString: () => "0.2" },
				releaseTxHash: TX_HASH,
				winnerTeam: { name: "Team Winner One" },
			},
			{
				rank: 2,
				amount: { toString: () => "0.1" },
				releaseTxHash: TX_HASH,
				winnerTeam: { name: "Team Winner Two" },
			},
		],
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockDb.event.findUnique.mockResolvedValue(completed);
	});

	afterEach(() => {
		cleanup();
	});

	it("shows the released outcome with winners and the hash instead of a 403, even to the judge", async () => {
		mockSession.mockResolvedValue({ id: "w-judge", address: JUDGE });

		await renderPage();

		const status = screen.getByRole("status");
		expect(status).toHaveTextContent(messages.JudgePage.done.title);
		expect(status).toHaveTextContent("Winner: Team Winner One");
		expect(status).toHaveTextContent("Winner: Team Winner Two");
		expect(screen.getByRole("link", { name: /0941dbcdd6/ })).toHaveAttribute(
			"href",
			expect.stringContaining(TX_HASH),
		);
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
		expect(screen.queryByTestId("release-form")).not.toBeInTheDocument();
	});

	it("shows the same outcome without a session", async () => {
		mockSession.mockResolvedValue(null);

		await renderPage();

		expect(screen.getByRole("status")).toHaveTextContent(
			messages.JudgePage.done.title,
		);
		expect(
			screen.queryByRole("button", { name: "connect-wallet" }),
		).not.toBeInTheDocument();
	});

	it("falls back to a dash when a prize has no winner recorded", async () => {
		mockDb.event.findUnique.mockResolvedValue({
			...completed,
			prizes: [
				{ ...completed.prizes[0], winnerTeam: null, releaseTxHash: null },
			],
		});
		mockSession.mockResolvedValue(null);

		await renderPage();

		expect(screen.getByRole("status")).toHaveTextContent("Winner: —");
		expect(
			screen.queryByRole("link", { name: /0941/ }),
		).not.toBeInTheDocument();
	});
});

describe("generateMetadata", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("titles the page with the event name", async () => {
		mockDb.event.findUnique.mockResolvedValue({ name: "Vertical slice A" });

		await expect(generateMetadata({ params })).resolves.toEqual({
			title: `${messages.JudgePage.title} — Vertical slice A`,
		});
		expect(mockDb.event.findUnique).toHaveBeenCalledWith({
			where: { id: EVENT_ID },
			select: { name: true },
		});
	});

	it("falls back to the bare title for an unknown event", async () => {
		mockDb.event.findUnique.mockResolvedValue(null);

		await expect(generateMetadata({ params })).resolves.toEqual({
			title: messages.JudgePage.title,
		});
	});
});
